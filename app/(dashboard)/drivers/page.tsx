import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DriversTable } from '@/components/drivers/DriversTable';
import { PaginationClient } from '@/components/ui/PaginationClient';
import { SearchClient } from '@/components/ui/SearchClient';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Driver } from '@prisma/client';

const ITEMS_PER_PAGE = 20;

export default async function DriversPage({
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

  let drivers: Driver[] = [];
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
            { name: { contains: searchQuery, mode: 'insensitive' as const } },
            { phone: { contains: searchQuery, mode: 'insensitive' as const } },
            { licenseNumber: { contains: searchQuery, mode: 'insensitive' as const } }
          ]
        } : {})
      };
      
      const [fetchedDrivers, count] = await prisma.$transaction([
        prisma.driver.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take: ITEMS_PER_PAGE,
        }),
        prisma.driver.count({
          where: whereClause,
        })
      ]);
      
      drivers = fetchedDrivers;
      totalItems = count;
    }
  } catch (err) {
    console.error("Prisma Connection Error in Drivers:", err);
  }

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Drivers" 
        description="Manage your drivers and their current availability."
        actionLabel="Add Driver"
        actionHref="/drivers/new"
      />
      <div className="flex items-center justify-between">
        <SearchClient placeholder="Search drivers by name, phone..." />
      </div>
      <DriversTable data={drivers} />
      <PaginationClient currentPage={currentPage} totalPages={totalPages} />
    </div>
  );
}
