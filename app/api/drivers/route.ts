import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { CreateDriverInput, DriverStatus } from '@/types'

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
    const status = searchParams.get('status') as DriverStatus | null

    const drivers = await prisma.driver.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(drivers)
  } catch (error) {
    console.error('GET /api/drivers error:', error)
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

    const body: CreateDriverInput = await request.json()

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const driver = await prisma.driver.create({
      data: {
        companyId,
        name: body.name.trim(),
        phone: body.phone ?? null,
        licenseNumber: body.licenseNumber ?? null,
        status: body.status ?? 'AVAILABLE',
        notes: body.notes ?? null,
      },
    })

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/drivers');

    return NextResponse.json(driver, { status: 201 })
  } catch (error) {
    console.error('POST /api/drivers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
