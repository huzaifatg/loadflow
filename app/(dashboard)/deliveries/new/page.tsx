import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DeliveryForm } from '@/components/deliveries/DeliveryForm';

export default function NewDeliveryPage() {
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
