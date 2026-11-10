import React from 'react';
import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { OptimizeLoadView } from '@/components/loads/OptimizeLoadView';
import { createClient } from '@/lib/supabase/server';

export default async function OptimizeLoadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Load Plans', href: '/loads' },
          { label: 'Load Optimizer' },
        ]}
        eyebrow="Multi-Vehicle Packing"
        title="Multi-Truck Load Optimizer"
        description="Automatically distribute pending deliveries across multiple available trucks to maximize fleet payload utilization."
      >
        <ButtonLink href="/loads/recommend" variant="secondary" size="sm">
          <Sparkles className="h-3.5 w-3.5 text-primary-600" />
          Single-Truck Recommender
        </ButtonLink>
      </PageHeader>
      <OptimizeLoadView />
    </div>
  );
}
