import React from 'react';
import { redirect } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { RecommendationView } from '@/components/loads/RecommendationView';
import { createClient } from '@/lib/supabase/server';

export default async function RecommendPage() {
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
          { label: 'Recommendations' },
        ]}
        eyebrow="Intelligent Dispatch"
        title="Fleet & Driver Recommendation Engine"
        description="Evaluate pending deliveries for a target date, score eligible trucks and drivers across capacity fit, availability, and workload, and create a draft load plan in one click."
      >
        <ButtonLink href="/loads/optimize" variant="secondary" size="sm">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary-600" />
          Multi-Truck Optimizer
        </ButtonLink>
      </PageHeader>
      <RecommendationView />
    </div>
  );
}
