import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import {
  validateCapacity,
  validateTruckConflict,
  validateDriverConflict,
  getDeliveryDateWarnings,
  type DateWarning,
} from '@/lib/services/load-plan-validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const company = auth.company;

    const id = (await params).id;

    const load = await prisma.loadPlan.findUnique({
      where: { 
        id,
        companyId: company.id,
      },
      include: {
        truck: true,
        driver: true,
        items: {
          include: {
            delivery: {
              include: {
                items: {
                  orderBy: { sortOrder: 'asc' },
                },
                _count: { select: { items: true } },
              },
            },
          },
          orderBy: {
            sortOrder: 'asc'
          }
        }
      }
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const company = auth.company;

    const id = (await params).id;
    const body = await request.json();
    const { truckId, driverId, status, notes, items } = body;

    const existingPlan = await prisma.loadPlan.findUnique({
      where: { id, companyId: company.id }
    });

    if (!existingPlan) {
      return NextResponse.json({ error: 'Load plan not found' }, { status: 404 });
    }

    // Guard: Prevent mutating core data of finalized plans
    const isFinalized = existingPlan.status === 'DISPATCHED' || existingPlan.status === 'COMPLETED';
    const isUpdatingCoreFields = items !== undefined || truckId !== undefined || driverId !== undefined;
    
    if (isFinalized && isUpdatingCoreFields) {
      return NextResponse.json({ 
        error: `Cannot modify a load plan that is ${existingPlan.status}. Please change the status back to READY first if you need to edit it.` 
      }, { status: 400 });
    }

    // Validate status transitions (state machine)
    if (status && status !== existingPlan.status) {
      const validTransitions: Record<string, string[]> = {
        'DRAFT': ['READY'],
        'READY': ['DRAFT', 'DISPATCHED'],
        'DISPATCHED': ['COMPLETED'],
        'COMPLETED': [],
      };
      const allowed = validTransitions[existingPlan.status] || [];
      if (!allowed.includes(status)) {
        return NextResponse.json({
          error: `Cannot transition from ${existingPlan.status} to ${status}. Allowed transitions: ${allowed.join(', ') || 'none'}.`
        }, { status: 400 });
      }
    }

    // ── Pre-transaction validation ──
    const finalTruckId = truckId ?? existingPlan.truckId;
    const finalDriverId = driverId !== undefined ? driverId : existingPlan.driverId;
    const finalDate = existingPlan.date; // date is not editable via PATCH today

    // Capacity enforcement: validate BEFORE entering the write transaction
    if (items && Array.isArray(items) && items.length > 0) {
      const capacityResult = await validateCapacity(prisma, finalTruckId, items);
      if (!capacityResult.valid) {
        return NextResponse.json({ error: capacityResult.error!.message }, { status: 400 });
      }
    }

    // Truck conflict detection (only when truck is being changed)
    if (truckId !== undefined && truckId !== existingPlan.truckId) {
      const truckConflict = await validateTruckConflict(
        prisma, truckId, finalDate, company.id, id,
      );
      if (!truckConflict.valid) {
        return NextResponse.json({ error: truckConflict.error!.message }, { status: 409 });
      }
    }

    // Driver conflict detection (only when driver is being changed)
    if (driverId !== undefined && driverId !== existingPlan.driverId) {
      const driverConflict = await validateDriverConflict(
        prisma, driverId, finalDate, company.id, id,
      );
      if (!driverConflict.valid) {
        return NextResponse.json({ error: driverConflict.error!.message }, { status: 409 });
      }
    }

    // Delivery date warnings (non-blocking)
    let dateWarnings: DateWarning[] = [];
    if (items && Array.isArray(items) && items.length > 0) {
      dateWarnings = await getDeliveryDateWarnings(prisma, items, finalDate);
    }

    // ── Write transaction ──
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Handle items array update if provided
      if (items && Array.isArray(items)) {
        const existingItems = await tx.loadPlanItem.findMany({
          where: { loadPlanId: id }
        });
        const existingDeliveryIds = existingItems.map(i => i.deliveryId);
        
        const toUnassign = existingDeliveryIds.filter(dId => !items.includes(dId));
        const toAssign = items.filter(dId => !existingDeliveryIds.includes(dId));

        // Delete old items
        await tx.loadPlanItem.deleteMany({
          where: { loadPlanId: id }
        });
        
        // Create new items
        for (let i = 0; i < items.length; i++) {
          await tx.loadPlanItem.create({
            data: {
              loadPlanId: id,
              deliveryId: items[i],
              sortOrder: i
            }
          });
        }

        // Update delivery statuses for lifecycle (PENDING / ASSIGNED)
        // H-5: Only update deliveries that are not CANCELLED
        if (toUnassign.length > 0) {
          await tx.delivery.updateMany({
            where: { id: { in: toUnassign }, status: { not: 'CANCELLED' } },
            data: { status: 'PENDING' }
          });
        }
        if (toAssign.length > 0) {
          await tx.delivery.updateMany({
            where: { id: { in: toAssign }, status: { not: 'CANCELLED' } },
            data: { status: 'ASSIGNED' }
          });
        }
      }

      // 2. Handle Load Plan status transitions
      if (status) {
        const currentItems = await tx.loadPlanItem.findMany({
          where: { loadPlanId: id }
        });
        const deliveryIds = currentItems.map(i => i.deliveryId);

        if (status === 'DISPATCHED') {
          if (deliveryIds.length > 0) {
            // H-5: Only transition non-cancelled deliveries
            await tx.delivery.updateMany({
              where: { id: { in: deliveryIds }, status: { not: 'CANCELLED' } },
              data: { status: 'IN_TRANSIT' }
            });
          }
          if (finalTruckId) {
            await tx.truck.update({
              where: { id: finalTruckId },
              data: { status: 'IN_USE' }
            });
          }
          if (finalDriverId) {
            await tx.driver.update({
              where: { id: finalDriverId },
              data: { status: 'ON_TRIP' }
            });
          }
        } else if (status === 'COMPLETED') {
          if (deliveryIds.length > 0) {
            // H-5: Only transition non-cancelled deliveries
            await tx.delivery.updateMany({
              where: { id: { in: deliveryIds }, status: { not: 'CANCELLED' } },
              data: { status: 'DELIVERED' }
            });
          }
          if (finalTruckId) {
            await tx.truck.update({
              where: { id: finalTruckId },
              data: { status: 'AVAILABLE' }
            });
          }
          if (finalDriverId) {
            await tx.driver.update({
              where: { id: finalDriverId },
              data: { status: 'AVAILABLE' }
            });
          }
        }
      }
      
      // 3. Update the load plan itself
      await tx.loadPlan.update({
        where: { id, companyId: company.id },
        data: {
          ...(truckId !== undefined ? { truckId } : {}),
          ...(driverId !== undefined ? { driverId } : {}),
          ...(status ? { status } : {}),
          ...(notes !== undefined ? { notes } : {}),
        }
      });
    });

    // Fetch the updated load plan to return
    const updatedLoad = await prisma.loadPlan.findUnique({
      where: { id, companyId: company.id },
      include: {
        truck: true,
        driver: true,
        items: {
          include: {
            delivery: {
              include: {
                items: { orderBy: { sortOrder: 'asc' } },
                _count: { select: { items: true } },
              },
            },
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    const { revalidatePath } = await import('next/cache');
    revalidatePath(`/loads/${id}`);
    revalidatePath('/loads');
    revalidatePath('/schedule');
    revalidatePath('/deliveries'); // Refresh deliveries list since they may now be assigned

    // Include date warnings in response if any exist
    if (dateWarnings.length > 0) {
      return NextResponse.json({ ...updatedLoad, _warnings: dateWarnings });
    }

    return NextResponse.json(updatedLoad);
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
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const company = auth.company;

    const id = (await params).id;

    const existingPlan = await prisma.loadPlan.findUnique({
      where: { id, companyId: company.id }
    });

    if (!existingPlan) {
      return NextResponse.json({ error: 'Load plan not found' }, { status: 404 });
    }

    if (existingPlan.status === 'DISPATCHED' || existingPlan.status === 'COMPLETED') {
      return NextResponse.json({ error: `Cannot delete a load plan that is ${existingPlan.status}.` }, { status: 400 });
    }

    // Optional: when a load plan is deleted, we should probably unassign deliveries
    await prisma.$transaction(async (tx) => {
      const existingItems = await tx.loadPlanItem.findMany({
        where: { loadPlanId: id }
      });
      const deliveryIds = existingItems.map(i => i.deliveryId);
      
      if (deliveryIds.length > 0) {
        await tx.delivery.updateMany({
          where: { id: { in: deliveryIds } },
          data: { status: 'PENDING' }
        });
      }

      await tx.loadPlan.delete({
        where: { 
          id,
          companyId: company.id 
        },
      });
    });

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/loads');
    revalidatePath('/schedule');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[load_DELETE]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
