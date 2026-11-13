import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { unauthorizedResponse } from '@/lib/security'
import { isValidUuid } from '@/lib/security/constants'
import { getDispatchAvailability } from '@/lib/services/dispatch-availability'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const rawDate = searchParams.get('date')
    if (rawDate && !/^\d{4}-\d{2}-\d{2}/.test(rawDate) && isNaN(new Date(rawDate).getTime())) {
      return NextResponse.json({ error: 'Invalid date parameter.' }, { status: 400 })
    }

    const excludePlanId = searchParams.get('excludePlanId')
    if (excludePlanId && !isValidUuid(excludePlanId)) {
      return NextResponse.json({ error: 'Invalid excludePlanId parameter.' }, { status: 400 })
    }

    const rawWeight = searchParams.get('requiredWeight')
    let requiredWeight: number | null = null
    if (rawWeight !== null && rawWeight !== '') {
      const parsed = Number(rawWeight)
      if (!Number.isFinite(parsed) || parsed < 0) {
        return NextResponse.json({ error: 'Invalid requiredWeight parameter.' }, { status: 400 })
      }
      requiredWeight = parsed
    }

    const data = await getDispatchAvailability(prisma, auth.companyId, {
      date: rawDate ?? undefined,
      excludePlanId,
      requiredWeight,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[dispatch_availability_GET]', error)
    return NextResponse.json({ error: 'Failed to evaluate resource availability.' }, { status: 500 })
  }
}

