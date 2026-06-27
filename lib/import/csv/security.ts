// ─── CSV Security Utilities ───────────────────────────────────────────────────
// Responsible for sanitizing values to prevent formula injection
// and detecting binary/invalid file content.

import { FORMULA_INJECTION_CHARS, FORMULA_SANITIZE_PREFIX } from './constants';

/**
 * Check if a cell value starts with a formula injection character.
 */
export function isFormulaInjection(value: string): boolean {
  if (value.length === 0) return false;
  return (FORMULA_INJECTION_CHARS as readonly string[]).includes(value[0]);
}

/**
 * Sanitize a cell value by prefixing it with a single quote
 * if it starts with a formula injection character.
 * This prevents Excel from executing the value as a formula
 * when the error report CSV is opened.
 */
export function sanitizeForExport(value: string): string {
  if (isFormulaInjection(value)) {
    return FORMULA_SANITIZE_PREFIX + value;
  }
  return value;
}

/**
 * Detect if content is likely a binary file rather than text.
 * Checks for null bytes and high concentration of control characters.
 */
export function isBinaryContent(content: string): boolean {
  // Null bytes are a strong indicator of binary content
  if (content.includes('\0')) return true;

  // Sample the first 1024 characters for control chars
  const sample = content.slice(0, 1024);
  let controlCount = 0;

  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    // Control characters excluding tab (9), LF (10), CR (13)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      controlCount++;
    }
  }

  // If more than 10% of the sample is control characters, it's binary
  return sample.length > 0 && controlCount / sample.length > 0.1;
}

/**
 * Validate that a file size is within acceptable limits.
 */
export function validateFileSize(sizeBytes: number, maxBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= maxBytes;
}
