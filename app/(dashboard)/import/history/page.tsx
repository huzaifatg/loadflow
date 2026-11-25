import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ImportHistoryClient } from '@/components/import/ImportHistoryClient';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ImportHistoryPage() {
  const user = await getCurrentUser();
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
