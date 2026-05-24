import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';
import { Card } from '@/components/ui/Card';
import { MapPin, Package, User, Weight } from 'lucide-react';
import type { Delivery } from '@prisma/client';
import { DeliveryDetailClient } from '@/components/deliveries/DeliveryDetailClient';

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

  return <DeliveryDetailClient delivery={delivery} />;
}
