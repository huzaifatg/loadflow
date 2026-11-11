import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { unauthorizedResponse, validatePathId, invalidIdResponse } from '@/lib/security';
import { deleteSavedView, sanitizeViewQuery } from '@/lib/services/saved-views';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const id = validatePathId((await params).id);
    if (!id) return invalidIdResponse();

    let body: { name?: unknown; query?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const existing = await prisma.savedView.findFirst({
      where: { id, companyId: auth.companyId, userId: auth.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Saved view not found.' }, { status: 404 });
    }

    const updateData: { name?: string; query?: string } = {};
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 40) {
        return NextResponse.json(
          { error: 'View name is required (max 40 characters).' },
          { status: 400 }
        );
      }
      updateData.name = name;
    }
    if (body.query !== undefined) {
      const query = typeof body.query === 'string' ? sanitizeViewQuery(body.query) : '';
      if (!query) {
        return NextResponse.json(
          { error: 'Select at least one filter before updating view.' },
          { status: 400 }
        );
      }
      updateData.query = query;
    }

    const updated = await prisma.savedView.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[saved-views_PATCH]', error);
    return NextResponse.json({ error: 'Failed to update saved view.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const id = validatePathId((await params).id);
    if (!id) return invalidIdResponse();

    const res = await deleteSavedView(prisma, auth.companyId, auth.userId, id);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[saved-views_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete saved view.' }, { status: 500 });
  }
}

