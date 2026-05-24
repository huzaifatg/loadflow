import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { DashboardLayoutShell } from '@/components/layout/DashboardLayoutShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch company to get custom profile name
  let company = null;
  try {
    company = await prisma.company.findFirst();
  } catch (err) {
    console.error("Failed to fetch company for identity", err);
  }

  // Determine fallback identity logic
  let name = company?.fullName || '';
  if (!name) {
    // Fallback to first part of email before @
    const emailPrefix = user.email ? user.email.split('@')[0] : 'User';
    // Capitalize first letter
    name = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }

  const initial = name.charAt(0).toUpperCase();
  const email = user.email || 'user@loadflow.app';

  return (
    <DashboardLayoutShell 
      userName={name} 
      userEmail={email} 
      userInitial={initial}
    >
      {children}
    </DashboardLayoutShell>
  );
}
