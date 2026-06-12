import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/landing/LandingPage';

export default async function RootPage() {
  const supabase = await createClient();

  // Gracefully check auth — don't block on network failure
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    // If auth check fails, show landing page
  }

  // Authenticated users go straight to the operational dashboard
  if (user) {
    redirect('/dashboard');
  }

  return <LandingPage />;
}
