// ─── RLS-Aware Prisma Client ─────────────────────────────────────────────────
// Provides a tenant-scoped Prisma transaction that enforces database-level RLS.
//
// ARCHITECTURE:
//   1. Connects as `postgres` (BYPASSRLS = true) for management operations
//   2. Within tenant-scoped transactions, uses SET LOCAL ROLE authenticated
//      + set_config('request.jwt.claim.sub', userId) to enforce RLS policies
//   3. SET LOCAL ROLE is transaction-scoped — automatically resets on commit/rollback
//
// USAGE:
//   import { withRLS } from '@/lib/rls';
//   const result = await withRLS(userId, async (tx) => {
//     return tx.truck.findMany();   // RLS enforced — only user's company data
//   });

import { prisma } from '@/lib/prisma';
import { Prisma, PrismaClient } from '@prisma/client';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Execute a Prisma operation within an RLS-enforced transaction.
 * 
 * Sets the PostgreSQL session to the `authenticated` role with the
 * given user's ID, causing all RLS policies to be evaluated against
 * their company membership.
 * 
 * @param userId - The Supabase auth user ID (auth.uid())
 * @param fn - The database operation to execute within the RLS scope
 * @returns The result of the database operation
 */
export async function withRLS<T>(
  userId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Set the JWT claim so auth.uid() returns the correct user
    await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`;
    // Switch to the authenticated role which does NOT bypass RLS
    await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    
    return fn(tx);
  }, {
    // Use a generous timeout for complex operations
    timeout: 30000,
  });
}

/**
 * Execute a raw SQL query within an RLS-enforced transaction.
 * Useful for complex queries that need direct SQL access.
 */
export async function withRLSRaw<T>(
  userId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return withRLS(userId, fn);
}
