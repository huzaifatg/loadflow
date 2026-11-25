import React from 'react';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { getAuthContext, getCurrentUser } from '@/lib/auth';

export default async function SettingsPage() {
  const user = await getCurrentUser();
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
      <PageHeader
        eyebrow="Workspace Configuration"
        title="Settings"
        description="Manage your profile, company details, and notification preferences."
      />

      <SettingsForm email={user.email} company={company ?? null} />
    </div>
  );
}
