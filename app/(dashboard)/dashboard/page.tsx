import React from 'react';
import { Package, Truck, Clock, CheckCircle2, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { format, startOfDay, endOfDay } from 'date-fns';
import { getAuthContext } from '@/lib/auth';

const statusStyles: Record<string, string> = {
  'IN_TRANSIT': 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
  'DISPATCHED': 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
  'ALLOCATED': 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  'ASSIGNED': 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  'CONFIRMED': 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  'READY': 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  'DELIVERED': 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  'COMPLETED': 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  'PENDING': 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-500/10',
  'DRAFT': 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-500/10',
};


export default async function DashboardPage() {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  // Resolve company for scoping
  const auth = await getAuthContext();
  const company = auth?.company;
  const companyId = auth?.companyId;

  // If no company exists yet, show zeros
  if (!companyId) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Set up your company in Settings to get started.</p>
        </div>
      </div>
    );
  }

  // 1. Batch Stats + Lists — all in one transaction for performance (P-1)
  const [
    totalDeliveries,
    deliveredDeliveries,
    pendingDeliveriesCount,
    activeTrucks,
    todaysDispatches,
    pendingDeliveriesList,
  ] = await prisma.$transaction([
    prisma.delivery.count({ where: { companyId, isArchived: false } }),
    prisma.delivery.count({ where: { companyId, status: 'DELIVERED', isArchived: false } }),
    prisma.delivery.count({ where: { companyId, status: 'PENDING', isArchived: false } }),
    prisma.truck.count({ where: { companyId, status: 'IN_USE', isArchived: false } }),
    prisma.loadPlan.findMany({
      where: {
        companyId,
        date: {
          gte: todayStart,
          lte: todayEnd,
        }
      },
      include: {
        truck: true,
        driver: true,
      },
      take: 5,
      orderBy: { date: 'asc' }
    }),
    prisma.delivery.findMany({
      where: { companyId, status: 'PENDING', isArchived: false },
      take: 5,
      orderBy: { createdAt: 'desc' }
    }),
  ]);

  const completionRate = totalDeliveries > 0 
    ? Math.round((deliveredDeliveries / totalDeliveries) * 100) 
    : 0;

  const stats = [
    {
      name: 'Total Deliveries',
      value: totalDeliveries.toString(),
      change: 'Lifetime total',
      changeType: 'neutral',
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Active Trucks',
      value: activeTrucks.toString(),
      change: 'Currently in use',
      changeType: 'positive',
      icon: Truck,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
    {
      name: 'Completed Rate',
      value: `${completionRate}%`,
      change: `${deliveredDeliveries} completed`,
      changeType: 'positive',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      name: 'Pending',
      value: pendingDeliveriesCount.toString(),
      change: 'Needs allocation',
      changeType: 'neutral',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your logistics operations for today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 transition-all hover:shadow-md"
          >
            <dt>
              <div className={cn("absolute rounded-xl p-3", stat.bgColor)}>
                <stat.icon className={cn("h-6 w-6", stat.color)} aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">
                {stat.name}
              </p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              <p
                className={cn(
                  "ml-2 flex items-baseline text-sm font-semibold",
                  stat.changeType === 'positive' ? 'text-green-600' : 
                  stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
                )}
              >
                {stat.changeType === 'positive' && <TrendingUp className="mr-1 h-3 w-3 self-center" />}
                {stat.changeType === 'negative' && <AlertTriangle className="mr-1 h-3 w-3 self-center" />}
                {stat.change}
              </p>
            </dd>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Today's Dispatches */}
        <div className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
            <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Dispatches</h2>
            <Link href="/schedule" className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50/50">
                  <th scope="col" className="whitespace-nowrap py-3.5 pl-6 pr-3 text-left text-xs font-semibold text-gray-500">Truck / Driver</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-500">Scheduled</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {todaysDispatches.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                      No loads scheduled for today.
                    </td>
                  </tr>
                )}
                {todaysDispatches.map((dispatch) => (
                  <tr key={dispatch.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-6 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                          <Truck className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <Link href={`/loads/${dispatch.id}`} className="font-medium text-gray-900 hover:text-primary-600">
                            {dispatch.truck.name}
                          </Link>
                          <div className="text-xs text-gray-500">{dispatch.driver?.name || 'Unassigned Driver'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {format(dispatch.date, 'h:mm a')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium", statusStyles[dispatch.status] || statusStyles['PENDING'])}>
                        {dispatch.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Deliveries */}
        <div className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
            <h2 className="text-lg font-semibold text-gray-900">Pending Deliveries</h2>
            <Link href="/deliveries" className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50/50">
                  <th scope="col" className="whitespace-nowrap py-3.5 pl-6 pr-3 text-left text-xs font-semibold text-gray-500">Order</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-500">Details</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pendingDeliveriesList.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                      No pending deliveries at this time.
                    </td>
                  </tr>
                )}
                {pendingDeliveriesList.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm">
                      <Link href={`/deliveries/${delivery.id}`} className="font-medium text-gray-900 hover:text-primary-600">
                        {delivery.customerName}
                      </Link>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{delivery.deliveryAddress}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="text-gray-900">{delivery.scheduledDate ? format(delivery.scheduledDate, 'MMM d, h:mm a') : 'Unscheduled'}</div>
                      <div className="text-xs font-semibold mt-0.5">{Math.round(Number(delivery.weight)).toLocaleString()} kg</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium", statusStyles[delivery.status] || statusStyles['PENDING'])}>
                        {delivery.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
