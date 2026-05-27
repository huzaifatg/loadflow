import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { CreateTruckInput, TruckStatus } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const companyId = auth.companyId

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as TruckStatus | null

    const trucks = await prisma.truck.findMany({
      where: {
        companyId,
        isArchived: false,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(trucks)
  } catch (error) {
    console.error('GET /api/trucks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const companyId = auth.companyId

    const body: CreateTruckInput = await request.json()

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!body.plateNumber?.trim()) {
      return NextResponse.json({ error: 'Plate number is required' }, { status: 400 })
    }
    if (body.weightCapacity == null || body.weightCapacity <= 0) {
      return NextResponse.json({ error: 'Weight capacity must be greater than 0' }, { status: 400 })
    }

    const truck = await prisma.truck.create({
      data: {
        companyId,
        name: body.name.trim(),
        type: body.type?.trim() || 'Box Truck',
        plateNumber: body.plateNumber.trim(),
        weightCapacity: body.weightCapacity,
        status: body.status ?? 'AVAILABLE',
        notes: body.notes ?? null,
      },
    })

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/trucks');
    revalidatePath('/schedule');
    revalidatePath('/loads');

    return NextResponse.json(truck, { status: 201 })
  } catch (error) {
    console.error('POST /api/trucks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
