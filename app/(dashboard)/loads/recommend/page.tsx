import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { RecommendationView } from '@/components/loads/RecommendationView';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function RecommendPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Recommendations"
        description="Get AI-powered truck and driver recommendations for your deliveries."
      />
      <RecommendationView />
    </div>
  );
}
