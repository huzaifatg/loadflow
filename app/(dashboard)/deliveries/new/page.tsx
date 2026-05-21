import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DeliveryForm } from '@/components/deliveries/DeliveryForm';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function NewDeliveryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Create Delivery" 
        description="Enter the details for the new delivery order."
      />
      <DeliveryForm />
    </div>
  );
}
