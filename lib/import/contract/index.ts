// ─── Import Document Contract — Public API ───────────────────────────────────

// Types
export type {
  ProcessingState,
  DiagnosticSeverity,
  DiagnosticStage,
  ImportDiagnostic,
  ImportSource,
  ImportAdapter,
  ImportHeader,
  FieldValidationResult,
  RowValidationState,
  RowMappingState,
  FieldDiff,
  RowPreviewState,
  RowCommitState,
  ImportRow,
  AdapterStatistics,
  ValidationStatistics,
  MappingStatistics,
  PreviewStatistics,
  CommitStatistics,
  ImportStatistics,
  ImportTimestamps,
  ImportDocument,
} from './types';

// Constants
export {
  CONTRACT_VERSION,
  PROCESSING_STATES,
  DIAGNOSTIC_SEVERITIES,
  DIAGNOSTIC_STAGES,
  DIAGNOSTIC_CODE_PREFIXES,
} from './constants';

// Guards
export {
  isProcessingState,
  stateOrdinal,
  isInState,
  assertState,
  isValidTransition,
  createTimestamp,
} from './guards';
