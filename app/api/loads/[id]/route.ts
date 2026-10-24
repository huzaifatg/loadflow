import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { validatePathId, unauthorizedResponse, invalidIdResponse } from '@/lib/security';
import { updateLoadPlan, deleteLoadPlan, PLAN_DETAIL_INCLUDE } from '@/lib/services/load-plan-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const company = auth.company;

    const id = validatePathId((await params).id);
    if (!id) return invalidIdResponse();

    const load = await prisma.loadPlan.findUnique({
      where: { 
        id,
        companyId: company.id,
      },
      include: PLAN_DETAIL_INCLUDE,
    });

    if (!load) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(load);
  } catch (error) {
    console.error('[load_GET]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH — edit (DRAFT only) or transition a load plan.
// All rules are enforced server-side in lib/services/load-plan-service.ts.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const company = auth.company;

    const id = validatePathId((await params).id);
    if (!id) return invalidIdResponse();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const result = await updateLoadPlan(prisma, company.id, id, {
      truckId: body.truckId,
      driverId: body.driverId,
      status: body.status,
      notes: body.notes,
      items: body.items,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.reasons ? { reasons: result.reasons } : {}) },
        { status: result.status },
      );
    }

    const { revalidatePath } = await import('next/cache');
    revalidatePath(`/loads/${id}`);
    revalidatePath('/loads');
    revalidatePath('/schedule');
    revalidatePath('/deliveries'); // Refresh deliveries list since they may now be assigned

    // Include non-blocking date warnings in response if any exist
    if (result.warnings.length > 0) {
      return NextResponse.json({ ...result.data, _warnings: result.warnings });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('[load_PATCH]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const company = auth.company;

    const id = validatePathId((await params).id);
    if (!id) return invalidIdResponse();

    const result = await deleteLoadPlan(prisma, company.id, id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/loads');
    revalidatePath('/schedule');
    revalidatePath('/deliveries');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[load_DELETE]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
