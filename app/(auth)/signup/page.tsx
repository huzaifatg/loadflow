'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { BoxesIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'http://localhost:3000/auth/callback',
          data: {
            full_name: fullName,
            company_name: companyName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

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
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Get started with intelligent logistics management
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/20">
        {/* Success message */}
        {success ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
              <CheckCircle2 className="h-6 w-6 text-success-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Check your email
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              We&apos;ve sent a confirmation link to{' '}
              <span className="font-medium text-gray-700">{email}</span>.
              Click the link to activate your account.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {/* Error banner */}
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
                <p className="text-sm text-danger-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Full name"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                autoFocus
                disabled={loading}
              />

              <Input
                label="Company name"
                type="text"
                placeholder="Acme Logistics"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                autoComplete="organization"
                disabled={loading}
              />

              <Input
                label="Email address"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                disabled={loading}
              />

              <Button
                type="submit"
                loading={loading}
                className="w-full"
                size="lg"
              >
                Create account
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
