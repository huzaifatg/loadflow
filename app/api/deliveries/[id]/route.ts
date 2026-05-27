import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import type { UpdateDeliveryInput } from '@/types'
import { computeItemWeight, recomputeDeliveryWeight } from '@/lib/delivery-items'

// ─── Valid delivery status values ────────────────────────────────────────────
const VALID_DELIVERY_STATUSES = ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as const
type ValidDeliveryStatus = typeof VALID_DELIVERY_STATUSES[number]

// ─── Allowed direct status transitions for delivery (from DeliveriesTable) ──
// Full lifecycle transitions (via load plan) are handled in loads/[id]/route.ts
const ALLOWED_DIRECT_TRANSITIONS: Record<string, string[]> = {
  'PENDING': ['CANCELLED'],
  'ASSIGNED': ['CANCELLED'],
  'IN_TRANSIT': [],   // Only via load plan COMPLETED
  'DELIVERED': [],     // Terminal state
  'CANCELLED': [],     // Terminal state
}

// ─── GET /api/deliveries/[id] ────────────────────────────────────────────────
// Get single delivery with load plan items (include loadPlan with truck info)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const delivery = await prisma.delivery.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
        loadPlanItems: {
          include: {
            loadPlan: {
              include: {
                truck: true,
                driver: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!delivery) {
      return NextResponse.json(
        { data: null, error: { message: 'Delivery not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: delivery, error: null })
  } catch (error) {
    console.error('GET /api/deliveries/[id] error:', error)
    return NextResponse.json(
      { data: null, error: { message: 'Failed to fetch delivery' } },
      { status: 500 }
    )
  }
}

// ─── PUT /api/deliveries/[id] ────────────────────────────────────────────────
// Update delivery. Prevent editing if status is IN_TRANSIT or DELIVERED (unless updating status or archiving).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find existing delivery
    const existing = await prisma.delivery.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        _count: { select: { loadPlanItems: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'Delivery not found' } },
        { status: 404 }
      )
    }

    const body = (await request.json()) as UpdateDeliveryInput & { isArchived?: boolean }

    // ── Validate status enum if provided ──
    if (body.status !== undefined) {
      if (!VALID_DELIVERY_STATUSES.includes(body.status as ValidDeliveryStatus)) {
        return NextResponse.json(
          { data: null, error: { message: `Invalid status: ${body.status}. Must be one of: ${VALID_DELIVERY_STATUSES.join(', ')}` } },
          { status: 400 }
        )
      }

      // ── Validate direct status transitions ──
      if (body.status !== existing.status) {
        const allowed = ALLOWED_DIRECT_TRANSITIONS[existing.status] || []
        if (!allowed.includes(body.status)) {
          return NextResponse.json(
            { data: null, error: { message: `Cannot change status from ${existing.status} to ${body.status} directly. ${existing.status === 'ASSIGNED' && body.status === 'IN_TRANSIT' ? 'Use the Load Plan dispatch flow instead.' : `Allowed transitions: ${allowed.join(', ') || 'none'}.`}` } },
            { status: 400 }
          )
        }
      }
    }

    // ── Block archive if delivery is assigned to a load plan ──
    if (body.isArchived === true && existing._count.loadPlanItems > 0) {
      return NextResponse.json(
        { data: null, error: { message: 'Cannot archive a delivery that is assigned to a load plan. Remove it from the load plan first.' } },
        { status: 400 }
      )
    }

    const isFinalized = existing.status === 'IN_TRANSIT' || existing.status === 'DELIVERED';
    const isUpdatingCoreFields = 
      body.customerName !== undefined || 
      body.pickupAddress !== undefined || 
      body.deliveryAddress !== undefined || 
      body.weight !== undefined ||
      body.items !== undefined;

    if (isFinalized && isUpdatingCoreFields) {
      return NextResponse.json(
        { data: null, error: { message: `Cannot edit core fields of a delivery that is ${existing.status.replace('_', ' ').toLowerCase()}` } },
        { status: 400 }
      )
    }

    // Build update data — only include fields that were provided
    const updateData: Record<string, unknown> = {}

    if (body.customerName !== undefined) {
      if (!body.customerName.trim()) {
        return NextResponse.json(
          { data: null, error: { message: 'Customer name cannot be empty' } },
          { status: 400 }
        )
      }
      updateData.customerName = body.customerName.trim()
    }
    if (body.pickupAddress !== undefined) {
      if (!body.pickupAddress.trim()) {
        return NextResponse.json(
          { data: null, error: { message: 'Pickup address cannot be empty' } },
          { status: 400 }
        )
      }
      updateData.pickupAddress = body.pickupAddress.trim()
    }
    if (body.deliveryAddress !== undefined) {
      if (!body.deliveryAddress.trim()) {
        return NextResponse.json(
          { data: null, error: { message: 'Delivery address cannot be empty' } },
          { status: 400 }
        )
      }
      updateData.deliveryAddress = body.deliveryAddress.trim()
    }
    if (body.weight !== undefined) {
      if (body.weight <= 0) {
        return NextResponse.json(
          { data: null, error: { message: 'Weight must be a positive number' } },
          { status: 400 }
        )
      }
      updateData.weight = body.weight
    }
    if (body.status !== undefined) {
      updateData.status = body.status
    }
    if (body.scheduledDate !== undefined) {
      updateData.scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes?.trim() || null
    }
    if (body.isArchived !== undefined) {
      updateData.isArchived = body.isArchived
      updateData.archivedAt = body.isArchived ? new Date() : null
    }

    // ── Handle items upsert (TRANSACTIONAL) ──
    // FIX C-7: Wrapping delete + create in a transaction to prevent data loss
    if (body.items !== undefined) {
      const delivery = await prisma.$transaction(async (tx) => {
        // Delete existing items
        await tx.deliveryItem.deleteMany({ where: { deliveryId: id } })

        if (body.items!.length > 0) {
          const itemsToCreate = body.items!.map((item, i) => {
            const computedWeight = computeItemWeight({
              unitType: item.unitType || 'STANDARD_WEIGHT',
              quantity: item.quantity,
              unitWeight: item.unitWeight ?? null,
              totalWeight: item.totalWeight ?? null,
            })
            return {
              deliveryId: id,
              productName: item.productName.trim(),
              sku: item.sku?.trim() || null,
              quantity: item.quantity,
              quantityUnit: item.quantityUnit || 'cartons',
              unitType: (item.unitType || 'STANDARD_WEIGHT') as 'STANDARD_WEIGHT' | 'VARIABLE_WEIGHT' | 'PIECE_BASED',
              unitWeight: item.unitWeight ?? null,
              totalWeight: computedWeight,
              notes: item.notes?.trim() || null,
              sortOrder: item.sortOrder ?? i,
            }
          })

          await tx.deliveryItem.createMany({ data: itemsToCreate })

          // Recompute delivery weight from items
          updateData.weight = recomputeDeliveryWeight(itemsToCreate)
        }

        // Update the delivery itself
        return tx.delivery.update({
          where: { id },
          data: updateData,
          include: {
            items: { orderBy: { sortOrder: 'asc' } },
          },
        })
      })

      const { revalidatePath } = await import('next/cache');
      revalidatePath('/deliveries');
      revalidatePath('/schedule');

      return NextResponse.json({ data: delivery, error: null })
    }

    // No items change — simple update
    const delivery = await prisma.delivery.update({
      where: { id },
      data: updateData,
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    })

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/deliveries');
    revalidatePath('/schedule');

    return NextResponse.json({ data: delivery, error: null })
  } catch (error) {
    console.error('PUT /api/deliveries/[id] error:', error)
    return NextResponse.json(
      { data: null, error: { message: 'Failed to update delivery' } },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/deliveries/[id] ─────────────────────────────────────────────
// Delete delivery. Prevent if allocated to a load plan.
// FIX C-5: Wrapped in transaction to prevent TOCTOU race.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.$transaction(async (tx) => {
      // Check and delete atomically
      const existing = await tx.delivery.findFirst({
        where: { id, companyId: auth.companyId },
        include: {
          _count: { select: { loadPlanItems: true } },
        },
      })

      if (!existing) {
        throw new Error('NOT_FOUND')
      }

      // Prevent deletion if allocated to a load plan
      if (existing._count.loadPlanItems > 0) {
        throw new Error('HAS_LOAD_PLANS')
      }

      await tx.delivery.delete({ where: { id } })
    })

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/deliveries');

    return NextResponse.json({ data: { id }, error: null })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json(
          { data: null, error: { message: 'Delivery not found' } },
          { status: 404 }
        )
      }
      if (error.message === 'HAS_LOAD_PLANS') {
        return NextResponse.json(
          { data: null, error: { message: 'Cannot delete a delivery that is allocated to a load plan. Remove it from the load plan first.' } },
          { status: 400 }
        )
      }
    }
    console.error('DELETE /api/deliveries/[id] error:', error)
    return NextResponse.json(
      { data: null, error: { message: 'Failed to delete delivery' } },
      { status: 500 }
    )
  }
}
