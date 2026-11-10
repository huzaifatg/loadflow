import React from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { LoadPlanSetupForm } from '@/components/loads/LoadPlanSetupForm';
import { getAuthContext } from '@/lib/auth';

export default async function NewLoadPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  let trucks: {
    id: string;
    name: string;
    type: string;
    plateNumber: string;
    weightCapacity: number;
  }[] = [];
  let drivers: { id: string; name: string; licenseNumber?: string | null }[] = [];
  let pendingDeliveryCount = 0;
  let dbError = false;

  try {
    const auth = await getAuthContext();
    const company = auth?.company;
    if (company) {
      [trucks, drivers, pendingDeliveryCount] = await prisma.$transaction([
        prisma.truck.findMany({
          where: {
            companyId: company.id,
            status: 'AVAILABLE',
            isArchived: false,
          },
          select: {
            id: true,
            name: true,
            type: true,
            plateNumber: true,
            weightCapacity: true,
          },
          orderBy: { name: 'asc' },
        }),
        prisma.driver.findMany({
          where: {
            companyId: company.id,
            status: 'AVAILABLE',
            isArchived: false,
          },
          select: { id: true, name: true, licenseNumber: true },
          orderBy: { name: 'asc' },
        }),
        prisma.delivery.count({
          where: {
            companyId: company.id,
            status: 'PENDING',
            isArchived: false,
          },
        }),
      ]);
    }
  } catch (err) {
    console.error('DB error in NewLoadPlanPage:', err);
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Load Plans', href: '/loads' },
          { label: 'Create Load Plan' },
        ]}
        title="Initialize Draft Load Plan"
        description="Choose a dispatch date, select an available truck, and optionally assign a driver before allocating pending deliveries."
      >
        <ButtonLink href="/loads/recommend" variant="secondary" size="sm">
          <Sparkles className="h-3.5 w-3.5 text-primary-600" />
          Use Recommendation Engine
        </ButtonLink>
      </PageHeader>

      {dbError ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-gray-900">
            Unable to connect to the database
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Please verify your connection and refresh the page.
          </p>
        </Card>
      ) : (
        <Card padding="lg">
          <LoadPlanSetupForm
            trucks={trucks}
            drivers={drivers}
            pendingDeliveryCount={pendingDeliveryCount}
          />
        </Card>
      )}
    </div>
  );
}
