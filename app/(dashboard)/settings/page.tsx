import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { getAuthContext } from '@/lib/auth';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  let company = null;
  try {
    const auth = await getAuthContext();
    company = auth?.company;
  } catch (err) {
    console.error("DB error in Settings:", err);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account, company details, and preferences.
        </p>
      </div>

      <SettingsForm email={user.email} company={company ?? null} />
    </div>
  );
}
