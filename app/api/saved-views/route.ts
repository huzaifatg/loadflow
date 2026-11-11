import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/security';
import {
  listSavedViews,
  upsertSavedView,
  isSavedViewWorkspace,
  DEFAULT_PRESET_VIEWS,
} from '@/lib/services/saved-views';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const workspaceParam = request.nextUrl.searchParams.get('workspace');
    const workspace = isSavedViewWorkspace(workspaceParam) ? workspaceParam : undefined;

    const customViews = await listSavedViews(prisma, auth.companyId, auth.userId, workspace);
    const presets = workspace ? DEFAULT_PRESET_VIEWS[workspace] : undefined;

    return NextResponse.json({
      presets: presets ?? [],
      customViews,
    });
  } catch (error) {
    console.error('[saved-views_GET]', error);
    return NextResponse.json({ error: 'Failed to load saved views.' }, { status: 500 });
  }
}

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

    const res = await upsertSavedView(prisma, auth.companyId, auth.userId, {
      workspace: body.workspace,
      name: body.name,
      query: body.query,
    });

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    return NextResponse.json(res.data, { status: 201 });
  } catch (error) {
    console.error('[saved-views_POST]', error);
    return NextResponse.json({ error: 'Failed to save view.' }, { status: 500 });
  }
}

