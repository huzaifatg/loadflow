import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const company = auth.company;

    const body = await request.json();
    const { truckId, driverId, date, notes } = body;

    const load = await prisma.loadPlan.create({
      data: {
        companyId: company.id,
        truckId,
        driverId: driverId || null,
        date: new Date(date),
        notes,
        status: 'DRAFT',
      },
      include: {
        truck: true,
        driver: true,
      }
    });

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/loads');
    revalidatePath('/schedule');

    return NextResponse.json(load);
  } catch (error) {
    console.error('[loads_POST]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
