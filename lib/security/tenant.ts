// ─── Tenant Isolation Utilities ───────────────────────────────────────────────
// Production-grade application-level tenant isolation for LoadFlow.
//
// These utilities provide strong multi-tenant isolation appropriate for the
// current architecture (Prisma + pgBouncer + postgres superuser role).
// True database-enforced RLS remains the long-term goal and will be activated
// when the connection architecture supports a non-superuser role.
//
// USAGE:
//   import { assertOwnership, validatePathId, unauthorizedResponse, forbiddenResponse } from '@/lib/security/tenant';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidUuid, SECURITY_CODES, SECURITY_MESSAGES } from './constants';

// ─── ID Validation ────────────────────────────────────────────────────────────

/**
 * Validate and return a path parameter as a UUID.
 * Returns the validated ID string, or null if invalid.
 */
export function validatePathId(id: string | undefined | null): string | null {
  if (!id || !isValidUuid(id)) return null;
  return id;
}

// ─── Ownership Assertion ──────────────────────────────────────────────────────

type TenantModel = 'truck' | 'driver' | 'delivery' | 'loadPlan' | 'importJob';

/**
 * Verify that a record belongs to the specified company.
 * Returns the record if ownership is confirmed, or null if the record
 * does not exist or belongs to a different tenant.
 *
 * This function performs a SELECT with both `id` and `companyId` in the WHERE
 * clause, ensuring no cross-tenant data is ever returned.
 */
export async function assertOwnership<T extends Record<string, unknown>>(
  model: TenantModel,
  recordId: string,
  companyId: string,
): Promise<T | null> {
  const where = { id: recordId, companyId };

  switch (model) {
    case 'truck':
      return await prisma.truck.findFirst({ where }) as T | null;
    case 'driver':
      return await prisma.driver.findFirst({ where }) as T | null;
    case 'delivery':
      return await prisma.delivery.findFirst({ where }) as T | null;
    case 'loadPlan':
      return await prisma.loadPlan.findFirst({ where }) as T | null;
    case 'importJob':
      return await prisma.importJob.findFirst({ where }) as T | null;
    default:
      return null;
  }
}

// ─── Standard Security Responses ──────────────────────────────────────────────

/**
 * 401 Unauthorized — user is not authenticated.
 */
export function unauthorizedResponse() {
  return NextResponse.json(
    { error: SECURITY_MESSAGES.UNAUTHENTICATED, code: SECURITY_CODES.UNAUTHENTICATED },
    { status: 401 },
  );
}

/**
 * 403 Forbidden — user is authenticated but lacks access to this resource.
 */
export function forbiddenResponse(message?: string) {
  return NextResponse.json(
    {
      error: message || SECURITY_MESSAGES.OWNERSHIP_VIOLATION,
      code: SECURITY_CODES.OWNERSHIP_VIOLATION,
    },
    { status: 403 },
  );
}

/**
 * 400 Bad Request — invalid identifier format.
 */
export function invalidIdResponse() {
  return NextResponse.json(
    { error: SECURITY_MESSAGES.INVALID_UUID, code: SECURITY_CODES.INVALID_UUID },
    { status: 400 },
  );
}
