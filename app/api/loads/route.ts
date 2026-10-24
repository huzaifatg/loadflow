import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/security';
import { createLoadPlan } from '@/lib/services/load-plan-service';

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const company = auth.company;

    const loads = await prisma.loadPlan.findMany({
      where: { companyId: company.id },
      include: {
        truck: true,
        driver: true,
        items: {
          include: {
            delivery: {
              include: {
                items: {
                  orderBy: { sortOrder: 'asc' },
                  take: 3,
                },
                _count: { select: { items: true } },
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(loads);
  } catch (error) {
    console.error('[loads_GET]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const company = auth.company;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    // Truck/driver ownership, status, UUIDs, date and conflicts are validated
    // server-side in createLoadPlan(). Driver is optional for a DRAFT.
    const result = await createLoadPlan(prisma, company.id, {
      truckId: body.truckId,
      driverId: body.driverId,
      date: body.date,
      notes: body.notes,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/loads');
    revalidatePath('/schedule');

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('[loads_POST]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

