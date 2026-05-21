import React from 'react';
import { Package, Truck, Clock, CheckCircle2, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// --- Mock Data ---

const stats = [
  {
    name: 'Total Deliveries',
    value: '142',
    change: '+12%',
    changeType: 'positive',
    icon: Package,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    name: 'Active Trucks',
    value: '24',
    change: '3 on break',
    changeType: 'neutral',
    icon: Truck,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
  {
    name: 'On Time Rate',
    value: '94.2%',
    change: '+2.1%',
    changeType: 'positive',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  {
    name: 'Delayed',
    value: '3',
    change: '-2',
    changeType: 'positive',
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
];

const todaysDispatches = [
  { id: 'TRK-102', driver: 'Marcus Johnson', destination: 'Chicago, IL', status: 'In Transit', time: '08:00 AM', progress: 65 },
  { id: 'TRK-094', driver: 'Sarah Connor', destination: 'Detroit, MI', status: 'Loading', time: '09:30 AM', progress: 10 },
  { id: 'TRK-115', driver: 'David Chen', destination: 'Indianapolis, IN', status: 'Delivered', time: '06:15 AM', progress: 100 },
  { id: 'TRK-088', driver: 'Elena Rodriguez', destination: 'Columbus, OH', status: 'In Transit', time: '07:45 AM', progress: 40 },
];

const pendingDeliveries = [
  { id: 'DEL-4921', client: 'Acme Corp', items: 24, weight: '4,200 lbs', priority: 'High', date: 'Today, 2:00 PM' },
  { id: 'DEL-4922', client: 'Stark Industries', items: 12, weight: '1,800 lbs', priority: 'Medium', date: 'Today, 4:30 PM' },
  { id: 'DEL-4923', client: 'Wayne Tech', items: 8, weight: '950 lbs', priority: 'Low', date: 'Tomorrow, 9:00 AM' },
  { id: 'DEL-4924', client: 'Global Logistics', items: 36, weight: '8,400 lbs', priority: 'High', date: 'Tomorrow, 11:00 AM' },
];

const statusStyles: Record<string, string> = {
  'In Transit': 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
  'Loading': 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  'Delivered': 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
};

const priorityStyles: Record<string, string> = {
  'High': 'text-red-700 bg-red-50 ring-red-600/10 ring-1 ring-inset',
  'Medium': 'text-amber-700 bg-amber-50 ring-amber-600/20 ring-1 ring-inset',
  'Low': 'text-slate-700 bg-slate-50 ring-slate-500/10 ring-1 ring-inset',
};

export default function DashboardPage() {
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
            <Link href="/deliveries" className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50/50">
                  <th scope="col" className="whitespace-nowrap py-3.5 pl-6 pr-3 text-left text-xs font-semibold text-gray-500">Truck / Driver</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-500">Destination</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {todaysDispatches.map((dispatch) => (
                  <tr key={dispatch.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-6 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                          <Truck className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{dispatch.id}</div>
                          <div className="text-xs text-gray-500">{dispatch.driver}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {dispatch.destination}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium", statusStyles[dispatch.status])}>
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
                  <th scope="col" className="whitespace-nowrap px-3 py-3.5 text-left text-xs font-semibold text-gray-500">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pendingDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm">
                      <div className="font-medium text-gray-900">{delivery.id}</div>
                      <div className="text-xs text-gray-500">{delivery.client}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="text-gray-900">{delivery.date}</div>
                      <div className="text-xs">{delivery.items} items • {delivery.weight}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium", priorityStyles[delivery.priority])}>
                        {delivery.priority}
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
