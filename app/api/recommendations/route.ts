import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/security';
import { startOfDay, endOfDay } from 'date-fns';
import {
  generateRecommendation,
  type RecommendationTruck,
  type RecommendationDriver,
  type RecommendationDelivery,
} from '@/lib/services/recommendation-engine';

// ─── POST /api/recommendations ──────────────────────────────────────────────
// Accepts a target date and optional delivery IDs.
// Returns the best truck + driver recommendation with explanations.

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { companyId } = auth;

    // ── Parse body ──
    let body: { date?: string; deliveryIds?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 },
      );
    }

    const { date, deliveryIds } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'A target date is required.' },
        { status: 400 },
      );
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format.' },
        { status: 400 },
      );
    }

    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    // ── Fetch deliveries ──
    const deliveries = await prisma.delivery.findMany({
      where: {
        companyId,
        isArchived: false,
        ...(deliveryIds && deliveryIds.length > 0
          ? { id: { in: deliveryIds } }
          : {
              status: 'PENDING',
              loadPlanItems: { none: {} },
              OR: [
                { scheduledDate: { gte: dayStart, lte: dayEnd } },
                { scheduledDate: null },
              ],
            }),
      },
      select: {
        id: true,
        customerName: true,
        deliveryAddress: true,
        weight: true,
        scheduledDate: true,
      },
    });

    if (deliveries.length === 0) {
      return NextResponse.json(
        { error: 'No eligible deliveries found.' },
        { status: 400 },
      );
    }

    // ── Fetch trucks with workload data ──
    const trucks = await prisma.truck.findMany({
      where: {
        companyId,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        plateNumber: true,
        weightCapacity: true,
        status: true,
        loadPlans: {
          where: {
            date: { gte: dayStart, lte: dayEnd },
            status: { in: ['DRAFT', 'READY', 'DISPATCHED'] },
          },
          select: {
            id: true,
            items: {
              select: {
                delivery: {
                  select: { weight: true },
                },
              },
            },
          },
        },
      },
    });

    // ── Fetch drivers with workload data ──
    const drivers = await prisma.driver.findMany({
      where: {
        companyId,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        licenseNumber: true,
        status: true,
        loadPlans: {
          where: {
            date: { gte: dayStart, lte: dayEnd },
            status: { in: ['DRAFT', 'READY', 'DISPATCHED'] },
          },
          select: { id: true },
        },
      },
    });

    // ── Transform for engine ──
    const engineDeliveries: RecommendationDelivery[] = deliveries.map(d => ({
      id: d.id,
      customerName: d.customerName,
      deliveryAddress: d.deliveryAddress,
      weight: d.weight,
      scheduledDate: d.scheduledDate,
    }));

    const engineTrucks: RecommendationTruck[] = trucks.map(t => {
      const committedWeight = t.loadPlans.reduce((sum, plan) => {
        return sum + plan.items.reduce((s, item) => s + Number(item.delivery.weight), 0);
      }, 0);
      return {
        id: t.id,
        name: t.name,
        plateNumber: t.plateNumber,
        weightCapacity: t.weightCapacity,
        status: t.status,
        activePlanCount: t.loadPlans.length,
        committedWeight,
      };
    });

    const engineDrivers: RecommendationDriver[] = drivers.map(d => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      licenseNumber: d.licenseNumber,
      status: d.status,
      activePlanCount: d.loadPlans.length,
    }));

    // ── Generate recommendation ──
    const result = generateRecommendation({
      deliveries: engineDeliveries,
      trucks: engineTrucks,
      drivers: engineDrivers,
    });

    return NextResponse.json({
      date: targetDate.toISOString(),
      deliveries: engineDeliveries,
      ...result,
    });
  } catch (error) {
    console.error('[recommendations_POST]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
