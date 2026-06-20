import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { startOfDay, endOfDay } from 'date-fns'
import { optimizeLoads } from '@/lib/services/load-optimizer'

export async function POST(request: NextRequest) {
  try {
    // ── Auth & tenant isolation ──
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const company = auth.company

    // ── Parse input ──
    const body = await request.json()
    const { date } = body

    if (!date) {
      return NextResponse.json(
        { error: 'A target date is required.' },
        { status: 400 },
      )
    }

    const targetDate = new Date(date)
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format.' },
        { status: 400 },
      )
    }

    const dayStart = startOfDay(targetDate)
    const dayEnd = endOfDay(targetDate)

    // ── Fetch eligible deliveries ──
    // PENDING deliveries that are not assigned to any load plan
    // and are either scheduled for the target date or have no scheduled date
    const eligibleDeliveries = await prisma.delivery.findMany({
      where: {
        companyId: company.id,
        status: 'PENDING',
        isArchived: false,
        loadPlanItems: { none: {} },
        OR: [
          { scheduledDate: { gte: dayStart, lte: dayEnd } },
          { scheduledDate: null },
        ],
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          take: 3,
          select: { productName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (eligibleDeliveries.length === 0) {
      return NextResponse.json(
        { error: 'No eligible deliveries found. All deliveries are either assigned or not in PENDING status.' },
        { status: 400 },
      )
    }

    // ── Fetch eligible trucks ──
    // Available, non-archived trucks that are NOT already assigned on the target date
    const allAvailableTrucks = await prisma.truck.findMany({
      where: {
        companyId: company.id,
        status: 'AVAILABLE',
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        plateNumber: true,
        weightCapacity: true,
      },
      orderBy: { weightCapacity: 'desc' },
    })

    // Filter out trucks that already have a plan on this date
    const existingPlansOnDate = await prisma.loadPlan.findMany({
      where: {
        companyId: company.id,
        date: { gte: dayStart, lte: dayEnd },
      },
      select: { truckId: true },
    })

    const assignedTruckIds = new Set(existingPlansOnDate.map(p => p.truckId))
    const eligibleTrucks = allAvailableTrucks.filter(t => !assignedTruckIds.has(t.id))

    if (eligibleTrucks.length === 0) {
      return NextResponse.json(
        { error: 'No eligible trucks available. All trucks are either in use, archived, or already assigned to a plan on this date.' },
        { status: 400 },
      )
    }

    // ── Run FFD optimization ──
    const result = optimizeLoads({
      deliveries: eligibleDeliveries,
      trucks: eligibleTrucks,
    })

    return NextResponse.json({
      date: targetDate.toISOString(),
      ...result,
    })
  } catch (error) {
    console.error('[loads_optimize_POST]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
