import React from 'react';
import { FileUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { DeliveryForm } from '@/components/deliveries/DeliveryForm';

export default function NewDeliveryPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Deliveries', href: '/deliveries' },
          { label: 'New Delivery' },
        ]}
        title="Create Delivery Order"
        description="Register a new customer delivery with route addresses, scheduled window, and payload weight."
      >
        <ButtonLink href="/import" variant="secondary" size="sm">
          <FileUp className="h-3.5 w-3.5" />
          Bulk Import CSV
        </ButtonLink>
      </PageHeader>
      <DeliveryForm />
    </div>
  );
}
