import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { validatePathId, unauthorizedResponse, invalidIdResponse } from '@/lib/security';

// ─── GET /api/import/history/[id] ───────────────────────────────────────────
// Returns a single ImportJob with all its ImportRow records.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const id = validatePathId((await params).id);
    if (!id) return invalidIdResponse();

    const job = await prisma.importJob.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      },
      include: {
        rows: {
          orderBy: { rowNumber: 'asc' },
          select: {
            id: true,
            rowNumber: true,
            rawData: true,
            mappedData: true,
            status: true,
            errors: true,
            warnings: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Import job not found.' }, { status: 404 });
    }

    return NextResponse.json({ data: job, error: null });
  } catch (error) {
    console.error('[GET /api/import/history/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import job details.' },
      { status: 500 },
    );
  }
}
