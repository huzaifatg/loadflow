// ─── Centralized Auth + Company Resolution ──────────────────────────────────
// All API routes and server components MUST use this helper instead of inline
// prisma.company.findFirst(). 

import { cache } from 'react';
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
 * Per-request deduplicated Supabase user lookup so layouts and nested server
 * pages don't issue redundant auth network roundtrips during a single render.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

/**
 * Authenticate the current request and resolve the user's company using the CompanyMember model.
 * If the user does not belong to a company, one is automatically provisioned for them.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  try {
    const user = await getCurrentUser();

    if (!user) return null;

    const member = await prisma.companyMember.findFirst({
      where: { userId: user.id },
      include: { company: true }
    });

    if (member?.company) {
      return {
        userId: user.id,
        email: user.email || '',
        company: member.company,
        companyId: member.company.id,
      };
    }

    // Auto-provisioning: If user doesn't belong to a company, create one for them inside a transaction.
    const emailPrefix = user.email ? user.email.split('@')[0] : 'User';
    const newCompanyName = `${emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)}'s Company`;

    const newCompany = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: newCompanyName,
          fullName: newCompanyName,
        }
      });
      
      await tx.companyMember.create({
        data: {
          companyId: company.id,
          userId: user.id,
          role: 'OWNER'
        }
      });
      
      return company;
    });

    return {
      userId: user.id,
      email: user.email || '',
      company: newCompany,
      companyId: newCompany.id,
    };
  } catch (err) {
    console.error('[getAuthContext] Error:', err);
    return null;
  }
});
