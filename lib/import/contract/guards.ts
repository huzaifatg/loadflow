// ─── Import Document Contract — Type Guards & State Assertions ───────────────

import type { ImportDocument, ProcessingState } from './types';
import { PROCESSING_STATES } from './constants';

/**
 * Check if a value is a valid ProcessingState.
 */
export function isProcessingState(value: unknown): value is ProcessingState {
  return typeof value === 'string' && (PROCESSING_STATES as readonly string[]).includes(value);
}

/**
 * Get the ordinal index of a processing state (0-based).
 * Returns -1 if the state is not recognized.
 */
export function stateOrdinal(state: ProcessingState): number {
  return PROCESSING_STATES.indexOf(state);
}

/**
 * Check if the document is in a specific processing state.
 */
export function isInState(doc: ImportDocument, expected: ProcessingState): boolean {
  return doc.processingState === expected;
}

/**
 * Assert that the document is in the expected state.
 * Throws if the state does not match.
 */
export function assertState(doc: ImportDocument, expected: ProcessingState): void {
  if (doc.processingState !== expected) {
    throw new Error(
      `ImportDocument "${doc.documentId}" is in state "${doc.processingState}" ` +
      `but expected "${expected}".`
    );
  }
}

/**
 * Check if a state transition is valid (forward-only).
 */
export function isValidTransition(from: ProcessingState, to: ProcessingState): boolean {
  return stateOrdinal(to) === stateOrdinal(from) + 1;
}

/**
 * Create a diagnostic timestamp (ISO 8601).
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}
