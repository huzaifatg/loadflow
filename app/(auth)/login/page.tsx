'use client';

import { useState, type FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BoxesIcon, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Show error from auth callback redirect
  const callbackError = searchParams.get('error');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Distinguish between network errors and auth errors
        if (signInError.message.includes('fetch') || signInError.message.includes('network')) {
          setError('Unable to connect to authentication service. Please check your internet connection and try again.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Unable to connect to authentication service. Please check your internet connection and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Callback error banner */}
      {callbackError && !error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
          <p className="text-sm text-danger-700">
            Authentication failed. Please sign in again.
          </p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
          <p className="text-sm text-danger-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email address"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
          disabled={loading}
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading}
        />

        <Button
          type="submit"
          loading={loading}
          className="w-full"
          size="lg"
        >
          Sign in
        </Button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      {/* Branding */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center justify-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-600/30">
            <BoxesIcon className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            LoadFlow
          </span>
        </div>
        <h1 className="text-xl font-semibold text-white">
          Sign in to your account
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Welcome back — manage your logistics with ease
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/20">
        <Suspense fallback={<div className="h-40 flex items-center justify-center">Loading...</div>}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
