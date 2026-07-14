import { type NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { importCsv } from '@/lib/import/pipeline';
import type { PipelineConfig } from '@/lib/import/pipeline';
import { DELIVERY_ENTITY } from '@/lib/import/mapping/profiles';
import type { ExistingRecord } from '@/lib/import/preview';

// ─── POST /api/import/csv ───────────────────────────────────────────────────
// Accepts a multipart form upload with a CSV file.
// Runs the pipeline through preview only (does NOT commit).
// Returns preview data for user review.

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
      tx: prisma as any,
      stopAfterPreview: true, // ← Stop after preview for user review
    };

    // ── Execute pipeline (preview only) ──────────────────────────────────
    const result = await importCsv(config);

    // ── Handle pipeline failure ──────────────────────────────────────────
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

      return NextResponse.json({
        success: false,
        importJobId: importJob.id,
        completedStage: result.completedStage,
        failedStage: result.failedStage,
        failureReason: result.failureReason,
        totalDurationMs: result.totalDurationMs,
        wasRolledBack: result.wasRolledBack,
        stats: { totalRows: 0, inserted: 0, updated: 0, failed: 0, skipped: 0 },
        timings: result.timings,
      });
    }

    // ── Save ImportRows for review ───────────────────────────────────────
    const doc = result.document;
    const previewSummary = result.previewSummary;

    if (doc && doc.rows.length > 0) {
      await prisma.importRow.createMany({
        data: doc.rows.map((row) => {
          const hasErrors = row.rowDiagnostics.some((d) => d.severity === 'error' || d.severity === 'fatal');
          const hasWarnings = row.rowDiagnostics.some((d) => d.severity === 'warning');
          const dbStatus = row.validationState?.status === 'invalid' || hasErrors ? 'ERROR'
            : hasWarnings ? 'WARNING'
            : 'VALID';

          return {
            importJobId: importJob.id,
            rowNumber: row.sourceRowNumber,
            rawData: row.originalValues as any,
            mappedData: (row.mappingState?.mappedValues ?? null) as any,
            status: dbStatus,
            errors: row.rowDiagnostics
              .filter((d) => d.severity === 'error' || d.severity === 'fatal')
              .map((d) => ({ code: d.code, message: d.message, column: d.column })) as any,
            warnings: row.rowDiagnostics
              .filter((d) => d.severity === 'warning')
              .map((d) => ({ code: d.code, message: d.message, column: d.column })) as any,
          };
        }),
      });
    }

    // ── Update ImportJob to READY_FOR_REVIEW ──────────────────────────────
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: 'READY_FOR_REVIEW',
        summary: {
          totalRows: previewSummary?.totalRows ?? doc?.rows.length ?? 0,
          rowsToCreate: previewSummary?.rowsToCreate ?? 0,
          rowsToUpdate: previewSummary?.rowsToUpdate ?? 0,
          rowsSkipped: previewSummary?.rowsSkipped ?? 0,
          rowsNoChange: previewSummary?.rowsNoChange ?? 0,
          duplicateKeyCount: previewSummary?.duplicateKeyCount ?? 0,
          warningCount: previewSummary?.warningCount ?? 0,
          errorCount: previewSummary?.errorCount ?? 0,
          totalDurationMs: result.totalDurationMs,
        },
      },
    });

    // ── Build preview response ───────────────────────────────────────────
    return NextResponse.json({
      success: true,
      importJobId: importJob.id,
      completedStage: result.completedStage,
      failedStage: null,
      failureReason: null,
      totalDurationMs: result.totalDurationMs,
      wasRolledBack: false,
      timings: result.timings,
      preview: {
        totalRows: previewSummary?.totalRows ?? 0,
        rowsToCreate: previewSummary?.rowsToCreate ?? 0,
        rowsToUpdate: previewSummary?.rowsToUpdate ?? 0,
        rowsSkipped: previewSummary?.rowsSkipped ?? 0,
        rowsNoChange: previewSummary?.rowsNoChange ?? 0,
        duplicateKeyCount: previewSummary?.duplicateKeyCount ?? 0,
        warningCount: previewSummary?.warningCount ?? 0,
        errorCount: previewSummary?.errorCount ?? 0,
        rows: previewSummary?.rows?.map((r) => ({
          rowNumber: r.sourceRowNumber,
          action: r.action,
          validationStatus: r.validationStatus,
          mappingStatus: r.mappingStatus,
          changedFieldCount: r.changedFieldCount,
          changedFields: r.changedFields,
          hasDuplicateKey: r.hasDuplicateKey,
          skipReason: r.skipReason,
          beforeValues: r.beforeValues,
          afterValues: r.afterValues,
        })) ?? [],
      },
    });
  } catch (error) {
    console.error('[POST /api/import/csv] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during import.' },
      { status: 500 },
    );
  }
}
