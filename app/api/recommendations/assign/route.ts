import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { isValidUuid, unauthorizedResponse } from '@/lib/security';
import {
  validateCapacity,
  validateTruckConflict,
  validateDriverConflict,
  getDeliveryDateWarnings,
} from '@/lib/services/load-plan-validation';

// ─── POST /api/recommendations/assign ───────────────────────────────────────
// Create a Load Plan from a dispatcher-approved recommendation.
// Validates all inputs server-side — never trusts the client recommendation.

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authentication ──
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { companyId } = auth;

    // ── 2. Parse body ──
    let body: {
      truckId?: string;
      driverId?: string | null;
      deliveryIds?: string[];
      date?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 },
      );
    }

    const { truckId, driverId, deliveryIds, date } = body;

    // ── 3. Validate required fields ──
    if (!truckId) {
      return NextResponse.json(
        { error: 'A truck ID is required.' },
        { status: 400 },
      );
    }
    if (!deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one delivery ID is required.' },
        { status: 400 },
      );
    }
    if (!date) {
      return NextResponse.json(
        { error: 'A target date is required.' },
        { status: 400 },
      );
    }

    // ── 4. Validate UUID format ──
    if (!isValidUuid(truckId)) {
      return NextResponse.json(
        { error: 'Invalid truck ID format.' },
        { status: 400 },
      );
    }
    if (driverId && !isValidUuid(driverId)) {
      return NextResponse.json(
        { error: 'Invalid driver ID format.' },
        { status: 400 },
      );
    }
    for (const id of deliveryIds) {
      if (!isValidUuid(id)) {
        return NextResponse.json(
          { error: `Invalid delivery ID format: ${id}` },
          { status: 400 },
        );
      }
    }

    // ── 5. Validate date ──
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format.' },
        { status: 400 },
      );
    }

    // ── 6. Verify truck ownership & status ──
    const truck = await prisma.truck.findFirst({
      where: { id: truckId, companyId, isArchived: false },
      select: { id: true, name: true, status: true, weightCapacity: true },
    });
    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found or does not belong to your company.' },
        { status: 404 },
      );
    }
    if (truck.status === 'MAINTENANCE') {
      return NextResponse.json(
        { error: `${truck.name} is currently in maintenance and cannot be assigned.` },
        { status: 409 },
      );
    }

    // ── 7. Verify driver ownership & status (if provided) ──
    if (driverId) {
      const driver = await prisma.driver.findFirst({
        where: { id: driverId, companyId, isArchived: false },
        select: { id: true, name: true, status: true },
      });
      if (!driver) {
        return NextResponse.json(
          { error: 'Driver not found or does not belong to your company.' },
          { status: 404 },
        );
      }
      if (driver.status === 'OFF_DUTY') {
        return NextResponse.json(
          { error: `${driver.name} is currently off duty and cannot be assigned.` },
          { status: 409 },
        );
      }
    }

    // ── 8. Verify delivery ownership & eligibility ──
    const deliveries = await prisma.delivery.findMany({
      where: { id: { in: deliveryIds }, companyId, isArchived: false },
      select: { id: true, customerName: true, status: true, weight: true },
    });

    // Check all delivery IDs were found (tenant isolation: missing = not owned)
    const foundIds = new Set(deliveries.map(d => d.id));
    const missingIds = deliveryIds.filter(id => !foundIds.has(id));
    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `Deliveries not found or do not belong to your company: ${missingIds.join(', ')}` },
        { status: 404 },
      );
    }

    // Check delivery eligibility — only PENDING deliveries can be assigned
    const ineligible = deliveries.filter(d => d.status !== 'PENDING');
    if (ineligible.length > 0) {
      const details = ineligible.map(d => `"${d.customerName}" (${d.status})`).join(', ');
      return NextResponse.json(
        { error: `The following deliveries are not eligible for assignment: ${details}. Only PENDING deliveries can be assigned.` },
        { status: 409 },
      );
    }

    // ── 9. Capacity check ──
    const capacityResult = await validateCapacity(prisma, truckId, deliveryIds);
    if (!capacityResult.valid) {
      return NextResponse.json(
        { error: capacityResult.error!.message },
        { status: 409 },
      );
    }

    // ── 10. Truck conflict check ──
    const truckConflict = await validateTruckConflict(
      prisma, truckId, targetDate, companyId,
    );
    if (!truckConflict.valid) {
      return NextResponse.json(
        { error: truckConflict.error!.message },
        { status: 409 },
      );
    }

    // ── 11. Driver conflict check ──
    const driverConflict = await validateDriverConflict(
      prisma, driverId || null, targetDate, companyId,
    );
    if (!driverConflict.valid) {
      return NextResponse.json(
        { error: driverConflict.error!.message },
        { status: 409 },
      );
    }

    // ── 12. Date warnings (non-blocking) ──
    const dateWarnings = await getDeliveryDateWarnings(
      prisma, deliveryIds, targetDate,
    );

    // ── 13. Transactional assignment ──
    const loadPlan = await prisma.$transaction(async (tx) => {
      // Create Load Plan
      const plan = await tx.loadPlan.create({
        data: {
          companyId,
          truckId,
          driverId: driverId || null,
          date: targetDate,
          status: 'DRAFT',
          notes: 'Created from recommendation engine',
        },
      });

      // Create Load Plan Items
      for (let i = 0; i < deliveryIds.length; i++) {
        await tx.loadPlanItem.create({
          data: {
            loadPlanId: plan.id,
            deliveryId: deliveryIds[i],
            sortOrder: i,
          },
        });
      }

      // Update delivery statuses to ASSIGNED
      await tx.delivery.updateMany({
        where: { id: { in: deliveryIds }, status: { not: 'CANCELLED' } },
        data: { status: 'ASSIGNED' },
      });

      // Return complete plan with relations
      return tx.loadPlan.findUnique({
        where: { id: plan.id },
        include: {
          truck: true,
          driver: true,
          items: {
            include: {
              delivery: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });

    // ── 14. Revalidate Next.js cache ──
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/loads');
    revalidatePath('/deliveries');
    revalidatePath('/schedule');
    revalidatePath('/dashboard');

    return NextResponse.json({
      success: true,
      loadPlan,
      warnings: dateWarnings.length > 0 ? dateWarnings : undefined,
    });

  } catch (error) {
    console.error('[recommendations/assign_POST]', error);
    return NextResponse.json(
      { error: 'Internal error during assignment. No changes were made.' },
      { status: 500 },
    );
  }
}
