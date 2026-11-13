import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { SavedViewsBar } from '@/components/ui/SavedViewsBar';
import { listSavedViews } from '@/lib/services/saved-views';
import {
  getDispatchBoardData,
  type DispatchBoardFilters,
} from '@/lib/services/dispatch-board';
import { DispatchBoardClient } from '@/components/dispatch/DispatchBoardClient';

export default async function DispatchBoardPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    scope?: string;
    status?: string;
    assignment?: string;
    truckId?: string;
    driverId?: string;
    conflict?: string;
    overdue?: string;
    q?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const auth = await getAuthContext();
  const companyId = auth?.companyId;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Dispatch & Scheduling Intelligence"
          title="Dispatch Board"
          description="Configure your company profile in Settings to start planning and dispatching loads."
          actionLabel="Open Settings"
          actionHref="/settings"
        />
      </div>
    );
  }

  const resolved = await searchParams;
  const filters: DispatchBoardFilters = {
    date: resolved.date ?? null,
    scope: resolved.scope === 'date' ? 'date' : 'all_active',
    status: resolved.status ?? 'ALL',
    assignment: (resolved.assignment as DispatchBoardFilters['assignment']) ?? 'ALL',
    truckId: resolved.truckId ?? 'ALL',
    driverId: resolved.driverId ?? 'ALL',
    conflict: (resolved.conflict as DispatchBoardFilters['conflict']) ?? 'ALL',
    overdue: (resolved.overdue as DispatchBoardFilters['overdue']) ?? 'ALL',
    q: resolved.q ?? '',
  };

  const [board, savedViews] = await Promise.all([
    getDispatchBoardData(prisma, companyId, filters),
    listSavedViews(prisma, companyId, auth.userId, 'dispatch'),
  ]);

  return (
    <div className="space-y-5">
      <DispatchBoardClient
        board={board}
        initialFilters={{
          q: resolved.q ?? '',
          status: (resolved.status ?? 'ALL').toUpperCase(),
          assignment: resolved.assignment ?? 'ALL',
          truckId: resolved.truckId ?? 'ALL',
          driverId: resolved.driverId ?? 'ALL',
          conflict: resolved.conflict ?? 'ALL',
          overdue: resolved.overdue ?? 'ALL',
        }}
      />
      <SavedViewsBar workspace="dispatch" initialCustomViews={savedViews} />
    </div>
  );
}

