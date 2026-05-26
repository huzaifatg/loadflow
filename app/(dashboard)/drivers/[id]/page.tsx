import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { User } from 'lucide-react';
import { DriverDetailClient } from '@/components/drivers/DriverDetailClient';

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const id = (await params).id;

  let driver = null;
  let loadPlans: { id: string; date: Date; status: string; _count: { items: number } }[] = [];
  try {
    const company = await prisma.company.findFirst();
    if (company) {
      driver = await prisma.driver.findUnique({
        where: { id, companyId: company.id },
      });
      if (driver) {
        loadPlans = await prisma.loadPlan.findMany({
          where: { driverId: driver.id, companyId: company.id },
          orderBy: { date: 'desc' },
          take: 10,
          select: { id: true, date: true, status: true, _count: { select: { items: true } } }
        });
      }
    }
  } catch (err) {
    console.error("Prisma Connection Error in DriverDetail:", err);
  }

  if (!driver) {
    return (
      <div className="space-y-6">
        <PageHeader title="Driver Not Found" />
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <User className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500">The requested driver could not be found or you don&apos;t have access.</p>
        </Card>
      </div>
    );
  }

  return <DriverDetailClient driver={driver} loadPlans={loadPlans} />;
}
