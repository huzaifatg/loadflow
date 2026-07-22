import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { importCsv } from '@/lib/import/pipeline';
import type { PipelineConfig } from '@/lib/import/pipeline';
import { DELIVERY_ENTITY } from '@/lib/import/mapping/profiles';

// ─── POST /api/import/commit ────────────────────────────────────────────────
// Accepts an importJobId and commits a previously previewed import.
// This is step 2 of the two-step import workflow.

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { companyId, userId } = auth;

    // ── Parse body ───────────────────────────────────────────────────────
    let body: { importJobId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 },
      );
    }

    const { importJobId } = body;
    if (!importJobId) {
      return NextResponse.json(
        { error: 'importJobId is required.' },
        { status: 400 },
      );
    }

    // ── Load ImportJob ───────────────────────────────────────────────────
    const importJob = await prisma.importJob.findFirst({
      where: {
        id: importJobId,
        companyId,
        status: 'READY_FOR_REVIEW',
      },
      include: {
        rows: {
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    if (!importJob) {
      return NextResponse.json(
        { error: 'Import job not found or not in reviewable state.' },
        { status: 404 },
      );
    }

    // ── Reconstruct CSV from stored raw data ─────────────────────────────
    // The import rows contain the original raw CSV values.
    // We need to rebuild the CSV content to re-run the full pipeline with commit.
    const rawRows = importJob.rows.map((r) => r.rawData as Record<string, string>);
    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: 'No rows found for this import job.' },
        { status: 400 },
      );
    }

    const headers = Object.keys(rawRows[0]);
    const csvLines = [
      headers.join(','),
      ...rawRows.map((row) =>
        headers.map((h) => {
          const val = String(row[h] ?? '');
          // Quote values that contain commas or quotes
          return val.includes(',') || val.includes('"')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        }).join(',')
      ),
    ];
    const csvContent = csvLines.join('\n');

    // ── Delete preview-phase ImportRows (commit engine will recreate them) ─
    await prisma.importRow.deleteMany({
      where: { importJobId },
    });

    // ── Update status to IMPORTING ───────────────────────────────────────
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: 'IMPORTING' },
    });

    // ── Build pipeline config (full pipeline with commit) ────────────────
    const config: PipelineConfig = {
      csvContent,
      filename: importJob.filename ?? 'import.csv',
      validationProfile: {
        name: 'delivery-csv-import',
        fields: [
          { column: 'customer_name', required: true, rules: [] },
          { column: 'pickup_address', required: true, rules: [] },
          { column: 'delivery_address', required: true, rules: [] },
        ],
      },
      mappingProfile: {
        name: 'delivery-mapping',
        entity: DELIVERY_ENTITY,
      },
      previewProfile: {
        matchKey: 'customerName',
        lookupFn: () => null,
      },
      commitProfile: {
        companyId,
        importJobId,
        uploadedBy: userId,
        matchKey: 'customerName',
        source: 'CSV',
      },
      tx: prisma as any,
      stopAfterPreview: false, // Run the full pipeline including commit
    };

    // ── Execute full pipeline ────────────────────────────────────────────
    const result = await importCsv(config);

    // ── Update ImportJob ─────────────────────────────────────────────────
    if (!result.success) {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          summary: {
            failedStage: result.failedStage,
            reason: result.failureReason,
            totalDurationMs: result.totalDurationMs,
          },
        },
      });
    }

    // ── Build response ───────────────────────────────────────────────────
    return NextResponse.json({
      success: result.success,
      importJobId,
      completedStage: result.completedStage,
      failedStage: result.failedStage,
      failureReason: result.failureReason,
      totalDurationMs: result.totalDurationMs,
      wasRolledBack: result.wasRolledBack,
      stats: {
        totalRows: result.document?.rows?.length ?? 0,
        inserted: result.document?.statistics?.commit?.inserted ?? 0,
        updated: result.document?.statistics?.commit?.updated ?? 0,
        failed: result.document?.statistics?.commit?.failed ?? 0,
        skipped: result.previewSummary?.rowsSkipped ?? 0,
      },
      timings: result.timings,
    });
  } catch (error) {
    console.error('[POST /api/import/commit] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during commit.' },
      { status: 500 },
    );
  }
}
