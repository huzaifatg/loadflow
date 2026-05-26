import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { CreateTruckInput, TruckStatus } from '@/types'

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
