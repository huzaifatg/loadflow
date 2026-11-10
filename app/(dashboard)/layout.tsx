import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardLayoutShell } from '@/components/layout/DashboardLayoutShell';
import { getAuthContext } from '@/lib/auth';

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

  let company = null;
  try {
    const auth = await getAuthContext();
    company = auth?.company;
  } catch (err) {
    console.error('Failed to fetch company for identity', err);
  }

  let name = company?.fullName || '';
  if (!name) {
    const emailPrefix = user.email ? user.email.split('@')[0] : 'User';
    name = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }

  const initial = name.charAt(0).toUpperCase();
  const email = user.email || 'user@loadflow.app';
  const companyName =
    company?.displayName || company?.name || 'LoadFlow Workspace';

  return (
    <DashboardLayoutShell
      userName={name}
      userEmail={email}
      userInitial={initial}
      companyName={companyName}
    >
      {children}
    </DashboardLayoutShell>
  );
}
