import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/security';
import { executeBulkDeliveries } from '@/lib/services/bulk-deliveries';
import { actorFromAuth } from '@/lib/services/activity';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const result = await executeBulkDeliveries(
      prisma,
      auth.companyId,
      {
        action: body.action,
        deliveryIds: body.deliveryIds,
        scheduledDate: body.scheduledDate,
      },
      actorFromAuth(auth),
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/deliveries');
    revalidatePath('/loads');
    revalidatePath('/schedule');
    revalidatePath('/dashboard');

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('[deliveries/bulk_POST]', error);
    return NextResponse.json(
      { error: 'Internal error during bulk operation.' },
      { status: 500 },
    );
  }
}

