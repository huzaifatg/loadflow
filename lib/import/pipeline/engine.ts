// ─── Import Pipeline — Engine ─────────────────────────────────────────────────
// Orchestrates the complete CSV import pipeline:
//   CSV → Parse → Adapt → Validate → Map → Preview → Commit
//
// This module does NOT contain any business logic.
// It calls each engine in order, propagates results, and handles failures.
// All logic lives in the individual engines.

import type { ImportDocument, ImportDiagnostic } from '../contract/types';
import { createTimestamp } from '../contract/guards';

// Engine imports
import { parseCsv } from '../csv';
import { csvToImportDocument } from '../adapters/csv/adapter';
import { validateDocument } from '../validation';
import { mapDocument } from '../mapping';
import { previewDocument } from '../preview';
import { commitDocument } from '../commit';

// Types
import type {
  PipelineConfig,
  ImportPipelineResult,
  PipelineStageTiming,
  PipelineStage,
} from './types';
import type { DocumentPreviewSummary } from '../preview';
import type { RowCommitResult } from '../commit';
import { PIPELINE_CODES } from './constants';

/**
 * Execute the full CSV import pipeline.
 *
 * This is the sole public entry point for the entire import subsystem.
 *
 * @param config - Complete pipeline configuration.
 * @returns An ImportPipelineResult describing the outcome.
 */
export async function importCsv(config: PipelineConfig): Promise<ImportPipelineResult> {
  const pipelineStart = performance.now();
  const timings: PipelineStageTiming[] = [];
  const pipelineDiagnostics: ImportDiagnostic[] = [];

  let doc: ImportDocument | null = null;
  let previewSummary: DocumentPreviewSummary | null = null;
  let commitResults: RowCommitResult[] | null = null;
  let lastCompletedStage: PipelineStage = 'parse';

  pipelineDiagnostics.push(makeDiagnostic(
    'info',
    PIPELINE_CODES.STARTED,
    `Pipeline started for "${config.filename}".`,
  ));

  // ── Stage 1: Parse ────────────────────────────────────────────────────────
  let stageStart = performance.now();
  let parseResult;
  try {
    parseResult = parseCsv(config.csvContent, config.parseOptions);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    timings.push({ stage: 'parse', durationMs: elapsed(stageStart) });
    pipelineDiagnostics.push(makeDiagnostic('fatal', PIPELINE_CODES.PARSE_FATAL, `Parse failed: ${errMsg}`));
    return makeFailResult('parse', 'parse', errMsg, null, pipelineDiagnostics, timings, pipelineStart);
  }

  // Check for parse failure (non-throwing)
  if (!parseResult.success || parseResult.diagnostics.some(e => e.severity === 'fatal')) {
    timings.push({ stage: 'parse', durationMs: elapsed(stageStart) });
    const fatalMsg = parseResult.diagnostics.filter(e => e.severity === 'fatal').map(e => e.message).join('; ') || 'Parse failed';
    pipelineDiagnostics.push(makeDiagnostic('fatal', PIPELINE_CODES.PARSE_FATAL, `Fatal parse error: ${fatalMsg}`));
    return makeFailResult('parse', 'parse', fatalMsg, null, pipelineDiagnostics, timings, pipelineStart);
  }

  timings.push({ stage: 'parse', durationMs: elapsed(stageStart) });
  pipelineDiagnostics.push(makeDiagnostic('info', PIPELINE_CODES.STAGE_COMPLETE, `Parse complete: ${parseResult.rows.length} rows.`));
  lastCompletedStage = 'parse';

  // ── Stage 2: Adapt ────────────────────────────────────────────────────────
  stageStart = performance.now();
  try {
    doc = csvToImportDocument(parseResult, config.filename, config.commitProfile.companyId);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    timings.push({ stage: 'adapt', durationMs: elapsed(stageStart) });
    pipelineDiagnostics.push(makeDiagnostic('fatal', PIPELINE_CODES.STAGE_FAILED, `Adapter failed: ${errMsg}`));
    return makeFailResult('parse', 'adapt', errMsg, null, pipelineDiagnostics, timings, pipelineStart);
  }

  timings.push({ stage: 'adapt', durationMs: elapsed(stageStart) });
  pipelineDiagnostics.push(makeDiagnostic('info', PIPELINE_CODES.STAGE_COMPLETE, `Adapter complete: ${doc.rows.length} rows adapted.`));
  lastCompletedStage = 'adapt';

  // ── Stage 3: Validate ─────────────────────────────────────────────────────
  stageStart = performance.now();
  try {
    doc = validateDocument(doc, config.validationProfile);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    timings.push({ stage: 'validate', durationMs: elapsed(stageStart) });
    pipelineDiagnostics.push(makeDiagnostic('error', PIPELINE_CODES.STAGE_FAILED, `Validation failed: ${errMsg}`));
    return makeFailResult('adapt', 'validate', errMsg, doc, pipelineDiagnostics, timings, pipelineStart);
  }

  timings.push({ stage: 'validate', durationMs: elapsed(stageStart) });

  // Check for validation errors that should halt the pipeline
  const validationStats = doc.statistics.validation;
  if (validationStats && validationStats.errorCount > 0) {
    pipelineDiagnostics.push(makeDiagnostic(
      'error',
      PIPELINE_CODES.VALIDATION_HALT,
      `Validation produced ${validationStats.errorCount} error(s). Pipeline halted.`,
    ));
    return makeFailResult('validate', 'validate', `${validationStats.errorCount} validation error(s)`, doc, pipelineDiagnostics, timings, pipelineStart);
  }

  pipelineDiagnostics.push(makeDiagnostic('info', PIPELINE_CODES.STAGE_COMPLETE, `Validation complete: ${validationStats?.validRows ?? 0} valid rows.`));
  lastCompletedStage = 'validate';

  // ── Stage 4: Map ──────────────────────────────────────────────────────────
  stageStart = performance.now();
  try {
    doc = mapDocument(doc, config.mappingProfile);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    timings.push({ stage: 'map', durationMs: elapsed(stageStart) });
    pipelineDiagnostics.push(makeDiagnostic('error', PIPELINE_CODES.STAGE_FAILED, `Mapping failed: ${errMsg}`));
    return makeFailResult('validate', 'map', errMsg, doc, pipelineDiagnostics, timings, pipelineStart);
  }

  timings.push({ stage: 'map', durationMs: elapsed(stageStart) });
  pipelineDiagnostics.push(makeDiagnostic('info', PIPELINE_CODES.STAGE_COMPLETE, `Mapping complete: ${doc.statistics.mapping?.mappedRows ?? 0} mapped rows.`));
  lastCompletedStage = 'map';

  // ── Stage 5: Preview ──────────────────────────────────────────────────────
  stageStart = performance.now();
  try {
    const previewResult = previewDocument(doc, config.previewProfile);
    doc = previewResult.document;
    previewSummary = previewResult.summary;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    timings.push({ stage: 'preview', durationMs: elapsed(stageStart) });
    pipelineDiagnostics.push(makeDiagnostic('error', PIPELINE_CODES.STAGE_FAILED, `Preview failed: ${errMsg}`));
    return makeFailResult('map', 'preview', errMsg, doc, pipelineDiagnostics, timings, pipelineStart);
  }

  timings.push({ stage: 'preview', durationMs: elapsed(stageStart) });
  pipelineDiagnostics.push(makeDiagnostic('info', PIPELINE_CODES.STAGE_COMPLETE, `Preview complete: ${previewSummary.rowsToCreate} create, ${previewSummary.rowsToUpdate} update, ${previewSummary.rowsSkipped} skip.`));
  lastCompletedStage = 'preview';

  // ── Stage 6: Commit ───────────────────────────────────────────────────────
  stageStart = performance.now();
  try {
    const commitResult = await commitDocument(doc, config.commitProfile, config.tx);
    doc = commitResult.document;
    commitResults = commitResult.results;

    timings.push({ stage: 'commit', durationMs: elapsed(stageStart) });

    if (!commitResult.success) {
      pipelineDiagnostics.push(makeDiagnostic(
        'fatal',
        PIPELINE_CODES.COMMIT_ROLLBACK,
        `Commit rolled back: ${commitResult.rollbackReason ?? 'unknown reason'}`,
      ));
      return {
        success: false,
        completedStage: 'preview',
        failedStage: 'commit',
        failureReason: commitResult.rollbackReason,
        document: doc,
        diagnostics: [...pipelineDiagnostics, ...doc.diagnostics],
        timings,
        totalDurationMs: elapsed(pipelineStart),
        previewSummary,
        commitResults,
        wasRolledBack: true,
      };
    }

    lastCompletedStage = 'commit';
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    timings.push({ stage: 'commit', durationMs: elapsed(stageStart) });
    pipelineDiagnostics.push(makeDiagnostic('fatal', PIPELINE_CODES.STAGE_FAILED, `Commit threw: ${errMsg}`));
    return {
      success: false,
      completedStage: 'preview',
      failedStage: 'commit',
      failureReason: errMsg,
      document: doc,
      diagnostics: [...pipelineDiagnostics, ...doc.diagnostics],
      timings,
      totalDurationMs: elapsed(pipelineStart),
      previewSummary,
      commitResults: null,
      wasRolledBack: true,
    };
  }

  // ── Success ─────────────────────────────────────────────────────────────
  pipelineDiagnostics.push(makeDiagnostic('info', PIPELINE_CODES.COMPLETE, `Pipeline completed successfully in ${elapsed(pipelineStart).toFixed(1)}ms.`));

  return {
    success: true,
    completedStage: 'commit',
    failedStage: null,
    failureReason: null,
    document: doc,
    diagnostics: [...pipelineDiagnostics, ...doc.diagnostics],
    timings,
    totalDurationMs: elapsed(pipelineStart),
    previewSummary,
    commitResults,
    wasRolledBack: false,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function elapsed(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}

function makeDiagnostic(
  severity: ImportDiagnostic['severity'],
  code: string,
  message: string,
): ImportDiagnostic {
  return {
    severity,
    code,
    message,
    stage: 'commit', // pipeline uses 'commit' stage as there's no 'pipeline' stage in the contract
    timestamp: createTimestamp(),
  };
}

function makeFailResult(
  completedStage: PipelineStage,
  failedStage: PipelineStage,
  reason: string,
  doc: ImportDocument | null,
  diagnostics: ImportDiagnostic[],
  timings: PipelineStageTiming[],
  pipelineStart: number,
): ImportPipelineResult {
  return {
    success: false,
    completedStage,
    failedStage,
    failureReason: reason,
    document: doc as ImportDocument, // may be null for parse-stage failures
    diagnostics: doc ? [...diagnostics, ...doc.diagnostics] : diagnostics,
    timings,
    totalDurationMs: elapsed(pipelineStart),
    previewSummary: null,
    commitResults: null,
    wasRolledBack: false,
  };
}
