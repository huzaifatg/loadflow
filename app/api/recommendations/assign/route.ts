import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/security';
import { createLoadPlan } from '@/lib/services/load-plan-service';
import { actorFromAuth } from '@/lib/services/activity';
import { revalidateLoadPlanViews } from '@/lib/cache';

// ─── POST /api/recommendations/assign ───────────────────────────────────────
// Create a Load Plan from a dispatcher-approved recommendation.
// Delegates validation, transactional allocation, activity logging, and
// tracking milestone creation to the canonical createLoadPlan() service.

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    let body: {
      truckId?: unknown;
      driverId?: unknown;
      deliveryIds?: unknown;
      date?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (!Array.isArray(body.deliveryIds) || body.deliveryIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one delivery ID is required.' },
        { status: 400 },
      );
    }

    const result = await createLoadPlan(
      prisma,
      auth.companyId,
      {
        truckId: body.truckId,
        driverId: body.driverId,
        date: body.date,
        notes: 'Created from recommendation engine',
        items: body.deliveryIds,
        activitySource: 'Recommendation Engine',
        capacityErrorStatus: 409,
      },
      actorFromAuth(auth),
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    revalidateLoadPlanViews();

    return NextResponse.json({
      success: true,
      loadPlan: result.data,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    });
  } catch (error) {
    console.error('[recommendations/assign_POST]', error);
    return NextResponse.json(
      { error: 'Internal error during assignment. No changes were made.' },
      { status: 500 },
    );
  }
}
