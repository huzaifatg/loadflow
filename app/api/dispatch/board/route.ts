import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { unauthorizedResponse } from '@/lib/security'
import { isValidUuid } from '@/lib/security/constants'
import {
  getDispatchBoardData,
  type DispatchBoardFilters,
} from '@/lib/services/dispatch-board'

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

    const filters: DispatchBoardFilters = {
      date: rawDate,
      scope: searchParams.get('scope') === 'date' ? 'date' : 'all_active',
      status: searchParams.get('status'),
      assignment: searchParams.get('assignment') as DispatchBoardFilters['assignment'],
      truckId: rawTruckId,
      driverId: rawDriverId,
      conflict: searchParams.get('conflict') as DispatchBoardFilters['conflict'],
      overdue: searchParams.get('overdue') as DispatchBoardFilters['overdue'],
      q: searchParams.get('q'),
    }

    const data = await getDispatchBoardData(prisma, auth.companyId, filters)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[dispatch_board_GET]', error)
    return NextResponse.json({ error: 'Failed to load dispatch board.' }, { status: 500 })
  }
}

