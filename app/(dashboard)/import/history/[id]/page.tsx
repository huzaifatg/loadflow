import React from 'react';
import { ImportDetailClient } from '@/components/import/ImportDetailClient';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { id } = await params;

  return <ImportDetailClient jobId={id} />;
}
