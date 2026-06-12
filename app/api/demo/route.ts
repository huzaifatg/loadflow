import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Demo credentials not configured' },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Demo login failed:', error);
      return NextResponse.json(
        { error: 'Failed to authenticate demo user' },
        { status: 401 }
      );
    }

    // Successfully signed in, redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Demo route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
