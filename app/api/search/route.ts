import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    if (!q) {
      return NextResponse.json({
        deliveries: [],
        loadPlans: [],
        trucks: [],
        drivers: [],
      });
    }

    const companyId = auth.companyId;

    const [deliveries, loadPlans, trucks, drivers] = await prisma.$transaction([
      prisma.delivery.findMany({
        where: {
          companyId,
          isArchived: false,
          OR: [
            { customerName: { contains: q, mode: 'insensitive' } },
            { pickupAddress: { contains: q, mode: 'insensitive' } },
            { deliveryAddress: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          customerName: true,
          deliveryAddress: true,
          status: true,
          weight: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.loadPlan.findMany({
        where: {
          companyId,
          OR: [
            { notes: { contains: q, mode: 'insensitive' } },
            { truck: { name: { contains: q, mode: 'insensitive' } } },
            { truck: { plateNumber: { contains: q, mode: 'insensitive' } } },
            { driver: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          status: true,
          date: true,
          truck: { select: { name: true, plateNumber: true } },
          driver: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.truck.findMany({
        where: {
          companyId,
          isArchived: false,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { plateNumber: { contains: q, mode: 'insensitive' } },
            { type: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          plateNumber: true,
          type: true,
          status: true,
          weightCapacity: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.driver.findMany({
        where: {
          companyId,
          isArchived: false,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { licenseNumber: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          phone: true,
          licenseNumber: true,
          status: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      deliveries: deliveries.map((d) => ({
        ...d,
        weight: Math.round(Number(d.weight)),
      })),
      loadPlans,
      trucks,
      drivers,
    });
  } catch (error) {
    console.error('[GET /api/search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute search' },
      { status: 500 }
    );
  }
}
