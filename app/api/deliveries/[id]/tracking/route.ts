import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { validatePathId, unauthorizedResponse, invalidIdResponse } from '@/lib/security'
import { actorFromAuth } from '@/lib/services/activity'
import {
  getDeliveryTrackingState,
  createOrRotateTrackingLink,
  revokeTrackingLink,
  addDeliveryTrackingMilestone,
} from '@/lib/services/tracking'

// ─── GET /api/deliveries/[id]/tracking ───────────────────────────────────────
// Fetch tracking link state and milestones for an authenticated company delivery.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = validatePathId((await params).id)
    if (!id) return invalidIdResponse()
    const auth = await getAuthContext()
    if (!auth) return unauthorizedResponse()

    const exists = await prisma.delivery.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true },
    })
    if (!exists) {
      return NextResponse.json(
        { data: null, error: { message: 'Delivery not found' } },
        { status: 404 }
      )
    }

    const state = await getDeliveryTrackingState(prisma, auth.companyId, id)
    return NextResponse.json({ data: state, error: null })
  } catch (error) {
    console.error('GET /api/deliveries/[id]/tracking error:', error)
    return NextResponse.json(
      { data: null, error: { message: 'Failed to load tracking state' } },
      { status: 500 }
    )
  }
}

// ─── POST /api/deliveries/[id]/tracking ──────────────────────────────────────
// Supports:
//   - action: 'generate' | 'rotate' | 'update_settings' (create/rotate link or update ETA/expiration)
//   - action: 'add_milestone' (create a customer-visible or internal milestone)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = validatePathId((await params).id)
    if (!id) return invalidIdResponse()
    const auth = await getAuthContext()
    if (!auth) return unauthorizedResponse()

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : 'generate'
    const actor = actorFromAuth(auth)

    if (action === 'add_milestone') {
      const result = await addDeliveryTrackingMilestone(
        prisma,
        auth.companyId,
        id,
        actor,
        {
          eventType: body.eventType,
          title: body.title,
          description: body.description,
          locationLabel: body.locationLabel,
          customerVisible: body.customerVisible,
        }
      )

      if (!result.ok) {
        return NextResponse.json(
          { data: null, error: { message: result.error } },
          { status: result.status }
        )
      }

      const { revalidatePath } = await import('next/cache')
      revalidatePath(`/deliveries/${id}`)

      return NextResponse.json({ data: result.data, error: null }, { status: 201 })
    }

    const rotate = action === 'rotate' || body.rotate === true
    const result = await createOrRotateTrackingLink(
      prisma,
      auth.companyId,
      id,
      actor,
      {
        rotate,
        expiresAt: body.expiresAt,
        estimatedDeliveryAt: body.estimatedDeliveryAt,
      }
    )

    if (!result.ok) {
      return NextResponse.json(
        { data: null, error: { message: result.error } },
        { status: result.status }
      )
    }

    const { revalidatePath } = await import('next/cache')
    revalidatePath(`/deliveries/${id}`)
    revalidatePath('/dashboard')

    return NextResponse.json(
      { data: result.data, created: result.created, error: null },
      { status: result.created ? 201 : 200 }
    )
  } catch (error) {
    console.error('POST /api/deliveries/[id]/tracking error:', error)
    return NextResponse.json(
      { data: null, error: { message: 'Failed to update delivery tracking' } },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/deliveries/[id]/tracking ────────────────────────────────────
// Revoke the active tracking link for this delivery.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = validatePathId((await params).id)
    if (!id) return invalidIdResponse()
    const auth = await getAuthContext()
    if (!auth) return unauthorizedResponse()

    const result = await revokeTrackingLink(
      prisma,
      auth.companyId,
      id,
      actorFromAuth(auth)
    )

    if (!result.ok) {
      return NextResponse.json(
        { data: null, error: { message: result.error } },
        { status: result.status }
      )
    }

    const { revalidatePath } = await import('next/cache')
    revalidatePath(`/deliveries/${id}`)
    revalidatePath('/dashboard')

    return NextResponse.json({ data: result.data, error: null })
  } catch (error) {
    console.error('DELETE /api/deliveries/[id]/tracking error:', error)
    return NextResponse.json(
      { data: null, error: { message: 'Failed to revoke tracking link' } },
      { status: 500 }
    )
  }
}
