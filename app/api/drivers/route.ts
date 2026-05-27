import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { CreateDriverInput, DriverStatus } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const companyId = auth.companyId

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as DriverStatus | null

    const drivers = await prisma.driver.findMany({
      where: {
        companyId,
        isArchived: false,
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
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const companyId = auth.companyId

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
    revalidatePath('/schedule');
    revalidatePath('/loads');

    return NextResponse.json(driver, { status: 201 })
  } catch (error) {
    console.error('POST /api/drivers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
