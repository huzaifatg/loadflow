import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';
import { Card } from '@/components/ui/Card';
import { MapPin, Package, User, Weight } from 'lucide-react';
import type { Delivery } from '@prisma/client';

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const id = (await params).id;

  let delivery = null;
  try {
    const company = await prisma.company.findFirst();
    if (company) {
      delivery = await prisma.delivery.findUnique({
        where: { id, companyId: company.id },
      });
    }
  } catch (err) {
    console.error("Prisma Connection Error in DeliveryDetail:", err);
  }


  if (!delivery) {
    return (
      <div className="space-y-6">
        <PageHeader title="Delivery Not Found" />
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500">The requested delivery does not exist or you do not have permission to view it.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`Delivery #${delivery.id.split('-')[0]}`} 
        description="Delivery details and tracking information."
      >
        <StatusPill status={delivery.status} />
      </PageHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-5">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            Customer Information
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500">Customer</span>
              <span className="font-medium text-gray-900">{delivery.customerName}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500 flex items-center gap-1.5">
                <Weight className="h-3.5 w-3.5" /> Weight
              </span>
              <span className="font-medium text-gray-900">{delivery.weight.toLocaleString()} lbs</span>
            </div>
            {delivery.scheduledDate && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500">Scheduled</span>
                <span className="font-medium text-gray-900">{new Date(delivery.scheduledDate).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500">Created</span>
              <span className="font-medium text-gray-900">{new Date(delivery.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            Route Details
          </h3>
          <div className="space-y-5">
            <div className="relative pl-6">
              <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
              <div className="absolute left-[5px] top-5 h-8 w-0.5 bg-gray-200" />
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Pickup</span>
              <span className="block mt-1 text-sm font-medium text-gray-900">{delivery.pickupAddress}</span>
            </div>
            <div className="relative pl-6">
              <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-primary-500 ring-4 ring-primary-50" />
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Dropoff</span>
              <span className="block mt-1 text-sm font-medium text-gray-900">{delivery.deliveryAddress}</span>
            </div>
          </div>
          {delivery.notes && (
            <div className="pt-4 border-t border-gray-100">
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notes</span>
              <p className="text-sm text-gray-700">{delivery.notes}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
