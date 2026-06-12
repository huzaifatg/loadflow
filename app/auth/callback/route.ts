import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed`
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      console.error('[auth/callback] Code exchange failed:', error?.message);
      return NextResponse.redirect(
        `${origin}/login?error=auth_callback_failed`
      );
    }

    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (err) {
    console.error('[auth/callback] Unexpected error:', err);
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed`
    );
  }
}
