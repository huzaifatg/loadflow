import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { UpdateDeliveryInput } from '@/types'

// ─── GET /api/deliveries/[id] ────────────────────────────────────────────────
// Get single delivery with load plan items (include loadPlan with truck info)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const company = await prisma.company.findFirst()
    if (!company) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }
    const companyId = company.id

    const delivery = await prisma.delivery.findFirst({
      where: { id, companyId },
      include: {
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

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const company = await prisma.company.findFirst()
    if (!company) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }
    const companyId = company.id

    // Find existing delivery
    const existing = await prisma.delivery.findFirst({
      where: { id, companyId },
    })

    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'Delivery not found' } },
        { status: 404 }
      )
    }

    const body = (await request.json()) as UpdateDeliveryInput & { isArchived?: boolean }

    const isFinalized = existing.status === 'IN_TRANSIT' || existing.status === 'DELIVERED';
    const isUpdatingCoreFields = 
      body.customerName !== undefined || 
      body.pickupAddress !== undefined || 
      body.deliveryAddress !== undefined || 
      body.weight !== undefined;

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

    const delivery = await prisma.delivery.update({
      where: { id },
      data: updateData,
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const company = await prisma.company.findFirst()
    if (!company) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }
    const companyId = company.id

    // Find existing delivery
    const existing = await prisma.delivery.findFirst({
      where: { id, companyId },
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

    // Prevent deletion if allocated to a load plan
    if (existing._count.loadPlanItems > 0) {
      return NextResponse.json(
        { data: null, error: { message: 'Cannot delete a delivery that is allocated to a load plan. Remove it from the load plan first.' } },
        { status: 400 }
      )
    }

    await prisma.delivery.delete({ where: { id } })

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/deliveries');

    return NextResponse.json({ data: { id }, error: null })
  } catch (error) {
    console.error('DELETE /api/deliveries/[id] error:', error)
    return NextResponse.json(
      { data: null, error: { message: 'Failed to delete delivery' } },
      { status: 500 }
    )
  }
}
