import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth'
import { unauthorizedResponse } from '@/lib/security'
import { isValidUuid } from '@/lib/security/constants'
import {
  getDispatchConflicts,
  type ConflictSeverity,
} from '@/lib/services/dispatch-conflicts'

const VALID_SEVERITIES = new Set<ConflictSeverity>(['BLOCKING', 'WARNING', 'INFO'])

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const rawDate = searchParams.get('date')
    if (rawDate && !/^\d{4}-\d{2}-\d{2}/.test(rawDate) && isNaN(new Date(rawDate).getTime())) {
      return NextResponse.json({ error: 'Invalid date parameter.' }, { status: 400 })
    }

    const rawSeverity = searchParams.get('severity')?.toUpperCase() as ConflictSeverity | undefined
    if (rawSeverity && !VALID_SEVERITIES.has(rawSeverity)) {
      return NextResponse.json(
        { error: 'Invalid severity parameter. Must be BLOCKING, WARNING, or INFO.' },
        { status: 400 },
      )
    }

    const rawPlanId = searchParams.get('planId')
    if (rawPlanId && !isValidUuid(rawPlanId)) {
      return NextResponse.json({ error: 'Invalid planId parameter.' }, { status: 400 })
    }

    const data = await getDispatchConflicts(prisma, auth.companyId, {
      date: rawDate,
      severity: rawSeverity,
      planId: rawPlanId ?? undefined,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[dispatch_conflicts_GET]', error)
    return NextResponse.json({ error: 'Failed to detect scheduling conflicts.' }, { status: 500 })
  }
}

