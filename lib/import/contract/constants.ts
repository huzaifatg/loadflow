// ─── Import Document Contract — Constants ────────────────────────────────────

import type { ProcessingState, DiagnosticSeverity, DiagnosticStage } from './types';

/** Current contract version. */
export const CONTRACT_VERSION = '1.0';

/** Valid processing states in pipeline order. */
export const PROCESSING_STATES: readonly ProcessingState[] = [
  'parsed',
  'validated',
  'mapped',
  'previewed',
  'committed',
] as const;

/** Valid diagnostic severity levels. */
export const DIAGNOSTIC_SEVERITIES: readonly DiagnosticSeverity[] = [
  'info',
  'warning',
  'error',
  'fatal',
] as const;

/** Valid diagnostic stages. */
export const DIAGNOSTIC_STAGES: readonly DiagnosticStage[] = [
  'adapter',
  'validation',
  'mapping',
  'preview',
  'commit',
] as const;

/** Diagnostic code prefixes by stage. */
export const DIAGNOSTIC_CODE_PREFIXES: Record<DiagnosticStage, string> = {
  adapter: 'CSV_',    // Default; adapters may use their own prefix
  validation: 'VAL_',
  mapping: 'MAP_',
  preview: 'PRV_',
  commit: 'CMT_',
} as const;
