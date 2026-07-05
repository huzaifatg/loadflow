// ─── Import Pipeline — Constants ──────────────────────────────────────────────

/** Diagnostic code prefix for the pipeline orchestrator. */
export const PIPELINE_PREFIX = 'PIP_';

/** Pipeline diagnostic codes. */
export const PIPELINE_CODES = {
  /** Pipeline started. */
  STARTED: `${PIPELINE_PREFIX}STARTED`,
  /** A pipeline stage completed successfully. */
  STAGE_COMPLETE: `${PIPELINE_PREFIX}STAGE_COMPLETE`,
  /** A pipeline stage failed. */
  STAGE_FAILED: `${PIPELINE_PREFIX}STAGE_FAILED`,
  /** Pipeline completed successfully. */
  COMPLETE: `${PIPELINE_PREFIX}COMPLETE`,
  /** Pipeline halted due to validation errors. */
  VALIDATION_HALT: `${PIPELINE_PREFIX}VALIDATION_HALT`,
  /** Pipeline halted due to fatal parse error. */
  PARSE_FATAL: `${PIPELINE_PREFIX}PARSE_FATAL`,
  /** Pipeline halted due to commit rollback. */
  COMMIT_ROLLBACK: `${PIPELINE_PREFIX}COMMIT_ROLLBACK`,
} as const;

/** Ordered list of pipeline stages. */
export const PIPELINE_STAGES = [
  'parse',
  'adapt',
  'validate',
  'map',
  'preview',
  'commit',
] as const;
