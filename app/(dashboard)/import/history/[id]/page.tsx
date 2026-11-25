import React from 'react';
import { ImportDetailClient } from '@/components/import/ImportDetailClient';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { id } = await params;

  return <ImportDetailClient jobId={id} />;
}
