// ─── CSV Parser Constants ─────────────────────────────────────────────────────

import type { Delimiter } from './types';

/** UTF-8 Byte Order Mark (BOM) as a string character. */
export const UTF8_BOM = '\uFEFF';

/** Maximum file size in bytes (50 MB). */
export const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Candidate delimiters for auto-detection, in priority order. */
export const CANDIDATE_DELIMITERS: readonly Delimiter[] = [',', ';', '\t', '|'];

/** Number of sample lines used for delimiter detection. */
export const DETECTION_SAMPLE_LINES = 20;

/**
 * Characters that indicate a potential CSV formula injection.
 * If a cell starts with any of these, it could execute as a formula
 * when the exported error report is opened in Excel.
 */
export const FORMULA_INJECTION_CHARS = ['=', '+', '-', '@', '\t', '\r'] as const;

/** Prefix added to sanitize potentially dangerous cell values. */
export const FORMULA_SANITIZE_PREFIX = "'";
