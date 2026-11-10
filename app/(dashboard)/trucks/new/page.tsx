import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TruckForm } from '@/components/trucks/TruckForm';

export default function NewTruckPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Trucks', href: '/trucks' },
          { label: 'Add Truck' },
        ]}
        title="Register Fleet Truck"
        description="Add a new vehicle with its license plate and payload weight capacity."
      />
      <TruckForm />
    </div>
  );
}
