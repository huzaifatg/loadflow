import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DeliveriesTable } from '@/components/deliveries/DeliveriesTable';
import { PaginationClient } from '@/components/ui/PaginationClient';
import { SearchClient } from '@/components/ui/SearchClient';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const ITEMS_PER_PAGE = 20;

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const currentPage = typeof resolvedParams.page === 'string' ? Math.max(1, parseInt(resolvedParams.page, 10)) : 1;
  const searchQuery = typeof resolvedParams.q === 'string' ? resolvedParams.q : '';

  let deliveries: any[] = [];
  let totalItems = 0;
  
  try {
    const company = await prisma.company.findFirst();
    if (company) {
      const skip = (currentPage - 1) * ITEMS_PER_PAGE;
      const whereClause = {
        companyId: company.id, 
        isArchived: false,
        ...(searchQuery ? {
          OR: [
            { customerName: { contains: searchQuery, mode: 'insensitive' as const } },
            { pickupAddress: { contains: searchQuery, mode: 'insensitive' as const } },
            { deliveryAddress: { contains: searchQuery, mode: 'insensitive' as const } }
          ]
        } : {})
      };
      
      const [fetchedDeliveries, count] = await prisma.$transaction([
        prisma.delivery.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take: ITEMS_PER_PAGE,
        }),
        prisma.delivery.count({
          where: whereClause,
        })
      ]);
      
      deliveries = fetchedDeliveries;
      totalItems = count;
    }
  } catch (err) {
    console.error("Prisma Connection Error in Deliveries:", err);
  }

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Deliveries" 
        description="Manage all inbound and outbound deliveries."
        actionLabel="New Delivery"
        actionHref="/deliveries/new"
      />
      <div className="flex items-center justify-between">
        <SearchClient placeholder="Search deliveries..." />
      </div>
      <DeliveriesTable data={deliveries} />
      <PaginationClient currentPage={currentPage} totalPages={totalPages} />
    </div>
  );
}
