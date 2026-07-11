import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { importCsv } from '@/lib/import/pipeline';
import type { PipelineConfig } from '@/lib/import/pipeline';
import { DELIVERY_ENTITY } from '@/lib/import/mapping/profiles';
import type { ExistingRecord } from '@/lib/import/preview';

// ─── POST /api/import/csv ───────────────────────────────────────────────────
// Accepts a multipart form upload with a CSV file.
// Invokes the full import pipeline and returns the result.

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { companyId, userId } = auth;

    // ── Parse multipart form ─────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request. Expected multipart form data with a CSV file.' },
        { status: 400 },
      );
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Upload a CSV file using the "file" field.' },
        { status: 400 },
      );
    }

    // ── Validate file ────────────────────────────────────────────────────
    const filename = file.name || 'upload.csv';

    if (!filename.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only CSV files are accepted.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'File is empty.' },
        { status: 400 },
      );
    }

    // ── Read CSV content ─────────────────────────────────────────────────
    const csvContent = await file.text();

    // ── Create ImportJob record ──────────────────────────────────────────
    const importJob = await prisma.importJob.create({
      data: {
        companyId,
        filename: filename.slice(0, 255), // sanitize length
        sourceType: 'CSV',
        status: 'PARSING',
        uploadedBy: userId,
        startedAt: new Date(),
      },
    });

    // ── Build pipeline config ────────────────────────────────────────────
    const config: PipelineConfig = {
      csvContent,
      filename,
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
        lookupFn: (_entity, _key, matchValue) => {
          // Synchronous lookup — for production, pre-load or use async
          return null; // All rows treated as creates for now
        },
      },
      commitProfile: {
        companyId,
        importJobId: importJob.id,
        uploadedBy: userId,
        matchKey: 'customerName',
        source: 'CSV',
      },
      tx: prisma as any, // Use Prisma client directly (not inside $transaction for now)
    };

    // ── Execute pipeline ─────────────────────────────────────────────────
    const result = await importCsv(config);

    // ── Update ImportJob on failure ───────────────────────────────────────
    if (!result.success) {
      await prisma.importJob.update({
        where: { id: importJob.id },
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
      importJobId: importJob.id,
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
    console.error('[POST /api/import/csv] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during import.' },
      { status: 500 },
    );
  }
}
