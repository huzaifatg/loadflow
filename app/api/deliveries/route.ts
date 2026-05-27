import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import type { CreateDeliveryInput } from '@/types'
import { computeItemWeight, recomputeDeliveryWeight } from '@/lib/delivery-items'

// ─── GET /api/deliveries ─────────────────────────────────────────────────────
// List deliveries for company. Supports ?status= and ?date= filters.
// Includes count of load plan items and delivery items.
// Sorted by scheduledDate ASC, createdAt DESC.
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { companyId } = auth

    // Parse query filters
    const searchParams = request.nextUrl.searchParams
    const statusFilter = searchParams.get('status')
    const dateFilter = searchParams.get('date')

    // Build where clause
    const where: Record<string, unknown> = { companyId, isArchived: false }

    if (statusFilter && statusFilter !== 'ALL') {
      where.status = statusFilter
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter)
      if (!isNaN(filterDate.getTime())) {
        // Match the entire day
        const startOfDay = new Date(filterDate)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(filterDate)
        endOfDay.setHours(23, 59, 59, 999)
        where.scheduledDate = { gte: startOfDay, lte: endOfDay }
      }
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        _count: {
          select: { loadPlanItems: true, items: true },
        },
        items: {
          orderBy: { sortOrder: 'asc' },
          take: 3, // Only fetch first 3 for summary display
        },
      },
      orderBy: [
        { scheduledDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({ data: deliveries, error: null })
  } catch (error) {
    console.error('GET /api/deliveries error:', error)
    return NextResponse.json(
      { data: null, error: { message: 'Failed to fetch deliveries' } },
      { status: 500 }
    )
  }
}

// ─── POST /api/deliveries ────────────────────────────────────────────────────
// Create a new delivery. Required: customerName, pickupAddress, deliveryAddress.
// Optional: items[], weight (legacy), scheduledDate, notes, status.
// If items are provided, weight is auto-computed from items.
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { companyId } = auth

    const body = (await request.json()) as CreateDeliveryInput

    // Validate required fields
    if (!body.customerName?.trim()) {
      return NextResponse.json(
        { data: null, error: { message: 'Customer name is required' } },
        { status: 400 }
      )
    }
    if (!body.pickupAddress?.trim()) {
      return NextResponse.json(
        { data: null, error: { message: 'Pickup address is required' } },
        { status: 400 }
      )
    }
    if (!body.deliveryAddress?.trim()) {
      return NextResponse.json(
        { data: null, error: { message: 'Delivery address is required' } },
        { status: 400 }
      )
    }

    const hasItems = body.items && body.items.length > 0

    // Validate weight: required if no items (legacy mode)
    if (!hasItems && (body.weight == null || body.weight <= 0)) {
      return NextResponse.json(
        { data: null, error: { message: 'Weight must be a positive number (or add items)' } },
        { status: 400 }
      )
    }

    // Compute item weights and aggregate delivery weight
    let deliveryWeight = body.weight || 0
    const itemsData: {
      productName: string
      sku: string | null
      quantity: number
      quantityUnit: string
      unitType: string
      unitWeight: number | null
      totalWeight: number
      notes: string | null
      sortOrder: number
    }[] = []

    if (hasItems) {
      for (let i = 0; i < body.items!.length; i++) {
        const item = body.items![i]
        const computedWeight = computeItemWeight({
          unitType: item.unitType || 'STANDARD_WEIGHT',
          quantity: item.quantity,
          unitWeight: item.unitWeight ?? null,
          totalWeight: item.totalWeight ?? null,
        })

        itemsData.push({
          productName: item.productName.trim(),
          sku: item.sku?.trim() || null,
          quantity: item.quantity,
          quantityUnit: item.quantityUnit || 'cartons',
          unitType: item.unitType || 'STANDARD_WEIGHT',
          unitWeight: item.unitWeight ?? null,
          totalWeight: computedWeight,
          notes: item.notes?.trim() || null,
          sortOrder: item.sortOrder ?? i,
        })
      }

      // Recompute delivery weight from items
      deliveryWeight = recomputeDeliveryWeight(itemsData)
    }

    const delivery = await prisma.delivery.create({
      data: {
        companyId,
        customerName: body.customerName.trim(),
        pickupAddress: body.pickupAddress.trim(),
        deliveryAddress: body.deliveryAddress.trim(),
        weight: deliveryWeight,
        status: body.status ?? 'PENDING',
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
        notes: body.notes?.trim() || null,
        ...(itemsData.length > 0 && {
          items: {
            create: itemsData.map(item => ({
              productName: item.productName,
              sku: item.sku,
              quantity: item.quantity,
              quantityUnit: item.quantityUnit,
              unitType: item.unitType as 'STANDARD_WEIGHT' | 'VARIABLE_WEIGHT' | 'PIECE_BASED',
              unitWeight: item.unitWeight,
              totalWeight: item.totalWeight,
              notes: item.notes,
              sortOrder: item.sortOrder,
            })),
          },
        }),
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    })

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/deliveries');

    return NextResponse.json({ data: delivery, error: null }, { status: 201 })
  } catch (error) {
    console.error('POST /api/deliveries error:', error)
    return NextResponse.json(
      { data: null, error: { message: 'Failed to create delivery' } },
      { status: 500 }
    )
  }
}
