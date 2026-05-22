import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { CreateDeliveryInput } from '@/types'

// ─── GET /api/deliveries ─────────────────────────────────────────────────────
// List deliveries for company. Supports ?status= and ?date= filters.
// Includes count of load plan items. Sorted by scheduledDate ASC, createdAt DESC.
export async function GET(request: NextRequest) {
  try {
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

    // Parse query filters
    const searchParams = request.nextUrl.searchParams
    const statusFilter = searchParams.get('status')
    const dateFilter = searchParams.get('date')

    // Build where clause
    const where: Record<string, unknown> = { companyId }

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
          select: { loadPlanItems: true },
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
// Create a new delivery. Required: customerName, pickupAddress, deliveryAddress, weight.
// Optional: scheduledDate, notes, status.
export async function POST(request: NextRequest) {
  try {
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
    if (body.weight == null || body.weight <= 0) {
      return NextResponse.json(
        { data: null, error: { message: 'Weight must be a positive number' } },
        { status: 400 }
      )
    }

    const delivery = await prisma.delivery.create({
      data: {
        companyId,
        customerName: body.customerName.trim(),
        pickupAddress: body.pickupAddress.trim(),
        deliveryAddress: body.deliveryAddress.trim(),
        weight: body.weight,
        status: body.status ?? 'PENDING',
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
        notes: body.notes?.trim() || null,
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
