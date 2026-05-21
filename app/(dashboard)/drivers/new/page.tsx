import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DriverForm } from '@/components/drivers/DriverForm';

export default function NewDriverPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Add New Driver" 
        description="Enter the driver's details to add them to your fleet."
      />
      <DriverForm />
    </div>
  );
}
