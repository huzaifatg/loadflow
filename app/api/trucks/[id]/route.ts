import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { UpdateTruckInput } from '@/types'

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

    const truck = await prisma.truck.findFirst({
      where: { id, companyId: company.id },
      include: {
        loadPlans: {
          orderBy: { date: 'desc' },
          take: 10,
          include: {
            driver: true,
            items: true,
          },
        },
      },
    })

    if (!truck) {
      return NextResponse.json({ error: 'Truck not found' }, { status: 404 })
    }

    return NextResponse.json(truck)
  } catch (error: unknown) {
    console.error('GET /api/trucks/[id] error:', error)
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

    // Verify truck belongs to company
    const existing = await prisma.truck.findFirst({
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
      return NextResponse.json({ error: 'Truck not found' }, { status: 404 })
    }

    if (body.isArchived === true && existing.loadPlans.length > 0) {
      return NextResponse.json(
        { error: 'Cannot archive a truck that is assigned to active load plans.' },
        { status: 400 }
      )
    }

    const truck = await prisma.truck.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.type !== undefined ? { type: body.type.trim() } : {}),
        ...(body.plateNumber !== undefined ? { plateNumber: body.plateNumber.trim() } : {}),
        ...(body.weightCapacity !== undefined ? { weightCapacity: body.weightCapacity } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.isArchived !== undefined ? { isArchived: body.isArchived, archivedAt: body.isArchived ? new Date() : null } : {}),
      },
    })

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/trucks');
    revalidatePath('/schedule');
    revalidatePath('/loads');

    return NextResponse.json(truck)
  } catch (error) {
    console.error('PUT /api/trucks/[id] error:', error)
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

    // Verify truck belongs to company
    const existing = await prisma.truck.findFirst({
      where: { id, companyId: company.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Truck not found' }, { status: 404 })
    }

    await prisma.truck.delete({ where: { id } })

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/trucks');
    revalidatePath('/schedule');
    revalidatePath('/loads');

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    // Prisma will throw if truck has load plans (Restrict)
    if (
      error instanceof Error &&
      error.message.includes('Foreign key constraint')
    ) {
      return NextResponse.json(
        { error: 'Cannot delete truck that has load plans. Remove load plans first.' },
        { status: 409 }
      )
    }
    console.error('DELETE /api/trucks/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
