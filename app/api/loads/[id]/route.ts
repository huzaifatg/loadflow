import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { Prisma } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await prisma.company.findFirst();

    if (!company) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

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
            delivery: true
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await prisma.company.findFirst();

    if (!company) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const id = (await params).id;
    const body = await request.json();
    const { truckId, driverId, status, notes, items } = body;

    // Optional: update items if provided
    // This assumes items is an array of deliveryIds in the new sorted order
    if (items && Array.isArray(items)) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
      });
    }

    const load = await prisma.loadPlan.update({
      where: { 
        id,
        companyId: company.id 
      },
      data: {
        ...(truckId && { truckId }),
        ...(driverId && { driverId }),
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        truck: true,
        driver: true,
        items: {
          include: { delivery: true },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    const { revalidatePath } = await import('next/cache');
    revalidatePath(`/loads/${id}`);
    revalidatePath('/loads');
    revalidatePath('/schedule');
    revalidatePath('/deliveries'); // Refresh deliveries list since they may now be assigned

    return NextResponse.json(load);
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await prisma.company.findFirst();

    if (!company) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const id = (await params).id;

    await prisma.loadPlan.delete({
      where: { 
        id,
        companyId: company.id 
      },
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
