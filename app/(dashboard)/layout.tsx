import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { DashboardLayoutShell } from '@/components/layout/DashboardLayoutShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <DashboardLayoutShell>{children}</DashboardLayoutShell>;
}
