import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';

// ─── GET /api/import/history ────────────────────────────────────────────────
// Returns all ImportJob records for the authenticated user's company.
// Ordered by createdAt DESC (newest first).

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { companyId } = auth;

    const jobs = await prisma.importJob.findMany({
      where: { companyId },
      select: {
        id: true,
        filename: true,
        sourceType: true,
        status: true,
        uploadedBy: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        summary: true,
        _count: {
          select: {
            rows: true,
            deliveries: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: jobs, error: null });
  } catch (error) {
    console.error('[GET /api/import/history] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import history.' },
      { status: 500 },
    );
  }
}
