import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Truck as TruckIcon } from 'lucide-react';
import { TruckDetailClient } from '@/components/trucks/TruckDetailClient';


export default async function TruckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const id = (await params).id;

  let truck = null;
  let loadPlans: { id: string; date: Date; status: string; _count: { items: number } }[] = [];
  try {
    const company = await prisma.company.findFirst();
    if (company) {
      truck = await prisma.truck.findUnique({
        where: { id, companyId: company.id },
      });
      if (truck) {
        loadPlans = await prisma.loadPlan.findMany({
          where: { truckId: truck.id, companyId: company.id },
          orderBy: { date: 'desc' },
          take: 10,
          select: { id: true, date: true, status: true, _count: { select: { items: true } } }
        });
      }
    }
  } catch (err) {
    console.error("Prisma Connection Error in TruckDetail:", err);
  }

  if (!truck) {
    return (
      <div className="space-y-6">
        <PageHeader title="Truck Not Found" />
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <TruckIcon className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500">The requested truck could not be found or you don&apos;t have access.</p>
        </Card>
      </div>
    );
  }

  return <TruckDetailClient truck={truck} loadPlans={loadPlans} />;
}
