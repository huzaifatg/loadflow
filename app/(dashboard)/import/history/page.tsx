import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ImportHistoryClient } from '@/components/import/ImportHistoryClient';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ImportHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <>
      <PageHeader
        title="Import History"
        description="View all past CSV imports and their results."
        actionLabel="New Import"
        actionHref="/import"
      />
      <ImportHistoryClient />
    </>
  );
}
