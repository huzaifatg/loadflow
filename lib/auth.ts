// ─── Centralized Auth + Company Resolution ──────────────────────────────────
// All API routes and server components MUST use this helper instead of inline
// prisma.company.findFirst(). When multi-tenancy is implemented, only this
// file needs to change.

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { Company } from '@prisma/client';

export interface AuthContext {
  userId: string;
  email: string;
  company: Company;
  companyId: string;
}

/**
 * Authenticate the current request and resolve the user's company.
 * Returns null if the user is not authenticated or has no company.
 *
 * TODO(multi-tenancy): Add userId filter to company lookup once
 * CompanyMember join table is added.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return null;

    const company = await prisma.company.findFirst();
    if (!company) return null;

    return {
      userId: user.id,
      email: user.email || '',
      company,
      companyId: company.id,
    };
  } catch (err) {
    console.error('[getAuthContext] Error:', err);
    return null;
  }
}
