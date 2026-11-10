import React from 'react';
import { redirect } from 'next/navigation';
import { Package, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { DeliveryDetailClient } from '@/components/deliveries/DeliveryDetailClient';
import { serializeDelivery } from '@/lib/delivery-items';
import { getAuthContext } from '@/lib/auth';

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const id = (await params).id;

  let delivery = null;
  try {
    const auth = await getAuthContext();
    const company = auth?.company;
    if (company) {
      delivery = await prisma.delivery.findUnique({
        where: { id, companyId: company.id },
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          loadPlanItems: {
            include: {
              loadPlan: {
                select: {
                  id: true,
                  status: true,
                  date: true,
                  truck: { select: { id: true, name: true, plateNumber: true } },
                  driver: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }
  } catch (err) {
    console.error('Prisma Connection Error in DeliveryDetail:', err);
  }

  if (!delivery) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: 'Deliveries', href: '/deliveries' },
            { label: 'Not Found' },
          ]}
          title="Delivery Not Found"
        />
        <Card className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
            <Package className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-gray-700">
            The requested delivery does not exist or belongs to another workspace.
          </p>
          <div className="mt-4">
            <ButtonLink href="/deliveries" variant="secondary" size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Deliveries
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  return <DeliveryDetailClient delivery={serializeDelivery(delivery)} />;
}
