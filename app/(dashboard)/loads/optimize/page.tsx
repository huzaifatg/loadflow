import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { OptimizeLoadView } from '@/components/loads/OptimizeLoadView';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function OptimizeLoadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Optimize Load Plans"
        description="Automatically distribute deliveries across trucks by weight utilization."
      />
      <OptimizeLoadView />
    </div>
  );
}
