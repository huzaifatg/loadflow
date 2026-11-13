import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { unauthorizedResponse } from '@/lib/security'
import { isValidUuid } from '@/lib/security/constants'
import { getDispatchCalendarData } from '@/lib/services/dispatch-board'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const rawDate = searchParams.get('date')
    if (rawDate && !/^\d{4}-\d{2}-\d{2}/.test(rawDate) && isNaN(new Date(rawDate).getTime())) {
      return NextResponse.json({ error: 'Invalid date parameter.' }, { status: 400 })
    }

    const rawTruckId = searchParams.get('truckId')
    if (rawTruckId && rawTruckId !== 'ALL' && !isValidUuid(rawTruckId)) {
      return NextResponse.json({ error: 'Invalid truckId parameter.' }, { status: 400 })
    }

    const rawDriverId = searchParams.get('driverId')
    if (
      rawDriverId &&
      rawDriverId !== 'ALL' &&
      rawDriverId !== 'UNASSIGNED' &&
      !isValidUuid(rawDriverId)
    ) {
      return NextResponse.json({ error: 'Invalid driverId parameter.' }, { status: 400 })
    }

    const data = await getDispatchCalendarData(prisma, auth.companyId, {
      date: rawDate,
      status: searchParams.get('status'),
      truckId: rawTruckId,
      driverId: rawDriverId,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[dispatch_calendar_GET]', error)
    return NextResponse.json({ error: 'Failed to load dispatch calendar.' }, { status: 500 })
  }
}

