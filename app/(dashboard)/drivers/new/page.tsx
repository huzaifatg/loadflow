import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DriverForm } from '@/components/drivers/DriverForm';

export default function NewDriverPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Drivers', href: '/drivers' },
          { label: 'Add Driver' },
        ]}
        title="Add Fleet Driver"
        description="Onboard a new driver to your company roster for load plan assignment."
      />
      <DriverForm />
    </div>
  );
}
