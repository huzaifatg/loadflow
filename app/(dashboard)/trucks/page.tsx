import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TruckCard } from '@/components/trucks/TruckCard';
import { PaginationClient } from '@/components/ui/PaginationClient';
import { SearchClient } from '@/components/ui/SearchClient';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Truck } from '@prisma/client';
import { getAuthContext } from '@/lib/auth';

const ITEMS_PER_PAGE = 12; // Divisible by 1, 2, 3, 4 for grid layouts

export default async function TrucksPage({
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

  let trucks: Truck[] = [];
  let totalItems = 0;

  try {
    const auth = await getAuthContext();
  const company = auth?.company;
  const companyId = auth?.companyId;
    if (company) {
      const skip = (currentPage - 1) * ITEMS_PER_PAGE;
      const whereClause = {
        companyId: company.id, 
        isArchived: false,
        ...(searchQuery ? {
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' as const } },
            { plateNumber: { contains: searchQuery, mode: 'insensitive' as const } },
            { type: { contains: searchQuery, mode: 'insensitive' as const } }
          ]
        } : {})
      };
      
      const [fetchedTrucks, count] = await prisma.$transaction([
        prisma.truck.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take: ITEMS_PER_PAGE,
        }),
        prisma.truck.count({
          where: whereClause,
        })
      ]);
      
      trucks = fetchedTrucks;
      totalItems = count;
    }
  } catch (err) {
    console.error("Prisma Connection Error in Trucks:", err);
  }

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Fleet Management" 
        description="Monitor and manage all your trucks and their capacities."
        actionLabel="Add Truck"
        actionHref="/trucks/new"
      />
      
      <div className="flex items-center justify-between">
        <SearchClient placeholder="Search trucks by name, plate..." />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {trucks.map((truck) => (
          <TruckCard 
            key={truck.id}
            id={truck.id}
            name={truck.name}
            plateNumber={truck.plateNumber}
            type={truck.type}
            weightCapacity={truck.weightCapacity}
            status={truck.status}
          />
        ))}
      </div>
      
      {trucks.length === 0 && (
        <div className="text-center py-12 text-gray-500 border rounded-xl border-dashed">
          No trucks found.
        </div>
      )}
      
      <PaginationClient currentPage={currentPage} totalPages={totalPages} />
    </div>
  );
}
