// ─── Security Constants ───────────────────────────────────────────────────────
// Centralized security-related constants for the LoadFlow application.
// All security utilities MUST reference these constants.

// ─── UUID Validation ──────────────────────────────────────────────────────────

/**
 * RFC 4122 UUID v4 pattern. Used to validate all externally-supplied identifiers
 * before they reach the database layer.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a well-formed UUID.
 * Returns true for valid UUIDs, false otherwise.
 */
export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

// ─── Security Error Codes ─────────────────────────────────────────────────────

export const SECURITY_CODES = {
  // Authentication
  UNAUTHENTICATED: 'AUTH_001',
  SESSION_EXPIRED: 'AUTH_002',

  // Authorization
  UNAUTHORIZED: 'AUTHZ_001',
  OWNERSHIP_VIOLATION: 'AUTHZ_002',
  INSUFFICIENT_ROLE: 'AUTHZ_003',

  // Input Validation
  INVALID_UUID: 'INPUT_001',
  INVALID_INPUT: 'INPUT_002',

  // Tenant Isolation
  TENANT_MISMATCH: 'TENANT_001',
  CROSS_TENANT_ACCESS: 'TENANT_002',
} as const;

// ─── Security Error Messages ─────────────────────────────────────────────────

export const SECURITY_MESSAGES = {
  UNAUTHENTICATED: 'Authentication required.',
  UNAUTHORIZED: 'You do not have permission to access this resource.',
  OWNERSHIP_VIOLATION: 'Resource does not belong to your organization.',
  INVALID_UUID: 'Invalid identifier format.',
  TENANT_MISMATCH: 'Cross-tenant access denied.',
} as const;
