import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { UserProfile } from '@/types'

export interface AuthenticatedUser {
  user: {
    id: string
    email: string | undefined
  }
  profile: UserProfile
}

/**
 * Get the currently authenticated user and their profile.
 *
 * This function:
 * 1. Creates a server-side Supabase client
 * 2. Retrieves the authenticated user via getUser() (secure, hits Supabase Auth server)
 * 3. Looks up the corresponding UserProfile in the database via Prisma
 *
 * If the user is not authenticated, they are redirected to /login.
 * If no UserProfile exists for the authenticated user, they are redirected to /onboarding.
 *
 * @returns The authenticated user and their profile
 */
export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: user.id },
  })

  if (!profile) {
    redirect('/onboarding')
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile as UserProfile,
  }
}

/**
 * Get the company ID for the currently authenticated user.
 *
 * Convenience wrapper around getCurrentUser() for use in API routes
 * and server components that only need the company scope.
 *
 * @returns The company ID string (UUID)
 */
export async function getCompanyId(): Promise<string> {
  const { profile } = await getCurrentUser()
  return profile.companyId
}
