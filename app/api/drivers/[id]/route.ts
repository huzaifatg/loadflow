import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

async function authenticate() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null
  const company = await prisma.company.findFirst()
  if (!company) return null
  return company
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const company = await authenticate()
    if (!company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const driver = await prisma.driver.findFirst({
      where: { id, companyId: company.id },
      include: {
        loadPlans: {
          orderBy: { date: 'desc' },
          take: 10,
          include: {
            truck: true,
            items: true,
          },
        },
      },
    })

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    return NextResponse.json(driver)
  } catch (error) {
    console.error('GET /api/drivers/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const company = await authenticate()
    if (!company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify driver belongs to company
    const existing = await prisma.driver.findFirst({
      where: { id, companyId: company.id },
      include: {
        loadPlans: {
          where: {
            status: { in: ['DRAFT', 'READY', 'DISPATCHED'] }
          }
        }
      }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    if (body.isArchived === true && existing.loadPlans.length > 0) {
      return NextResponse.json(
        { error: 'Cannot archive a driver that is assigned to active load plans.' },
        { status: 400 }
      )
    }

    const driver = await prisma.driver.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.licenseNumber !== undefined ? { licenseNumber: body.licenseNumber } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.isArchived !== undefined ? { isArchived: body.isArchived, archivedAt: body.isArchived ? new Date() : null } : {}),
      },
    })

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/drivers');
    revalidatePath('/schedule');
    revalidatePath('/loads');

    return NextResponse.json(driver)
  } catch (error) {
    console.error('PUT /api/drivers/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const company = await authenticate()
    if (!company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify driver belongs to company
    const existing = await prisma.driver.findFirst({
      where: { id, companyId: company.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    await prisma.driver.delete({ where: { id } })

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/drivers');
    revalidatePath('/schedule');
    revalidatePath('/loads');

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    // Prisma will throw if driver has load plans (Restrict)
    if (
      error instanceof Error &&
      error.message.includes('Foreign key constraint')
    ) {
      return NextResponse.json(
        { error: 'Cannot delete driver that has load plans. Remove load plans first.' },
        { status: 409 }
      )
    }
    console.error('DELETE /api/drivers/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
