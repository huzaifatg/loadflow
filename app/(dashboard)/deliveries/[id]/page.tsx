import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';
import { Card } from '@/components/ui/Card';

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const company = await prisma.company.findFirst();

  if (!company) redirect('/login');

  const id = (await params).id;
  const delivery = await prisma.delivery.findUnique({
    where: { id, companyId: company.id },
  });

  if (!delivery) {
    return (
      <div className="space-y-6">
        <PageHeader title="Delivery Not Found" />
        <Card className="p-6">
          <p className="text-gray-500">The requested delivery does not exist or you do not have permission to view it.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`Delivery ${delivery.id.split('-')[0]}`} 
        description="Delivery details and status."
      >
        <StatusPill status={delivery.status} />
      </PageHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Customer Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{delivery.customerName}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Weight</span>
              <span className="font-medium text-gray-900">{delivery.weight.toLocaleString()} lbs</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Routing</h3>
          <div className="space-y-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-gray-500 uppercase">Pickup</span>
              <span className="block mt-1 font-medium text-gray-900">{delivery.pickupAddress}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-gray-500 uppercase">Dropoff</span>
              <span className="block mt-1 font-medium text-gray-900">{delivery.deliveryAddress}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
