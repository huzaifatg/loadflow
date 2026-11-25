import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Package,
  Truck,
  Users,
  ClipboardList,
  CheckCircle2,
  ArrowRight,
  Scale,
  Shield,
  Kanban,
  Navigation,
} from 'lucide-react';

function GuideSection({
  icon: Icon,
  title,
  children,
  step,
  href,
  ctaLabel,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  step?: number;
  href?: string;
  ctaLabel?: string;
}) {
  return (
    <Card className="overflow-hidden mb-5 hover:shadow-md transition-shadow">
      <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {step && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
              {step}
            </div>
          )}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm border border-gray-100 text-primary-600">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
        {href && ctaLabel && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 shrink-0"
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="p-6 text-sm text-gray-600 space-y-3">{children}</div>
    </Card>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <PageHeader
        eyebrow="Workspace Reference"
        title="How LoadFlow Works"
        description="End-to-end daily operational workflow from delivery ingestion to customer shipment tracking."
        actionLabel="Open Dispatch Board"
        actionHref="/dispatch"
      />

      <Card className="bg-gradient-to-br from-primary-600 to-primary-800 text-white overflow-hidden relative">
        <div className="relative p-7 sm:p-8">
          <h2 className="text-xl font-bold mb-2">Core Operational Model</h2>
          <p className="text-primary-100 text-sm leading-relaxed max-w-3xl">
            LoadFlow connects <strong>Deliveries</strong> (customer orders),{' '}
            <strong>Trucks</strong> and <strong>Drivers</strong> (fleet capacity), and{' '}
            <strong>Load Plans</strong> through the lifecycle{' '}
            <code className="rounded bg-white/15 px-1.5 py-0.5 text-xs font-semibold text-white">
              DRAFT → READY ↔ DISPATCHED → COMPLETED
            </code>
            , backed by live conflict checks and customer tracking portals.
          </p>
        </div>
      </Card>

      <div>
        <GuideSection
          step={1}
          icon={Package}
          title="Enter or Import Deliveries"
          href="/deliveries"
          ctaLabel="Deliveries"
        >
          <p>
            Start by adding individual customer orders on{' '}
            <Link href="/deliveries/new" className="font-semibold text-primary-600 hover:underline">
              New Delivery
            </Link>{' '}
            or bulk importing spreadsheets via{' '}
            <Link href="/import" className="font-semibold text-primary-600 hover:underline">
              CSV Import
            </Link>
            .
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Itemize pallets, boxes, or weight units — LoadFlow computes total weight automatically.</li>
            <li>Use bulk selection on the Deliveries table to reschedule, cancel, archive, or export CSV.</li>
          </ul>
        </GuideSection>

        <GuideSection
          step={2}
          icon={Truck}
          title="Maintain Fleet & Drivers"
          href="/trucks"
          ctaLabel="Fleet"
        >
          <p>
            Register vehicles with accurate payload capacities on{' '}
            <Link href="/trucks" className="font-semibold text-primary-600 hover:underline">
              Trucks
            </Link>{' '}
            and maintain driver availability on{' '}
            <Link href="/drivers" className="font-semibold text-primary-600 hover:underline">
              Drivers
            </Link>
            .
          </p>
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-100">
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1">
                <Truck className="h-4 w-4 text-primary-500" /> Trucks
              </div>
              <p className="text-xs text-gray-600">
                Vehicles in Maintenance are automatically excluded from recommendations and dispatch.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-100">
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1">
                <Users className="h-4 w-4 text-primary-500" /> Drivers
              </div>
              <p className="text-xs text-gray-600">
                Drivers marked Off Duty are blocked from assignment until set back to Available.
              </p>
            </div>
          </div>
        </GuideSection>

        <GuideSection
          step={3}
          icon={ClipboardList}
          title="Build & Optimize Load Plans"
          href="/loads"
          ctaLabel="Load Plans"
        >
          <p>
            Create plans manually on{' '}
            <Link href="/loads/new" className="font-semibold text-primary-600 hover:underline">
              New Load Plan
            </Link>
            , score the best single vehicle + driver with{' '}
            <Link href="/loads/recommend" className="font-semibold text-primary-600 hover:underline">
              Recommendations
            </Link>
            , or distribute multiple orders across available trucks with the{' '}
            <Link href="/loads/optimize" className="font-semibold text-primary-600 hover:underline">
              Multi-Truck Optimizer
            </Link>
            .
          </p>
        </GuideSection>

        <GuideSection
          step={4}
          icon={Kanban}
          title="Coordinate on Dispatch Board & Calendar"
          href="/dispatch"
          ctaLabel="Dispatch Board"
        >
          <p>
            Use the{' '}
            <Link href="/dispatch" className="font-semibold text-primary-600 hover:underline">
              Dispatch Board
            </Link>{' '}
            for daily execution and the{' '}
            <Link href="/dispatch/calendar" className="font-semibold text-primary-600 hover:underline">
              7-Day Dispatch Calendar
            </Link>{' '}
            for weekly capacity planning.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Spot truck or driver overlaps, missing drivers, overdue orders, and capacity blockers live.</li>
            <li>Allocate pending orders to Draft plans or swap trucks/drivers directly from the board.</li>
          </ul>
        </GuideSection>

        <GuideSection
          step={5}
          icon={CheckCircle2}
          title="Lock Ready, Dispatch & Share Customer Tracking"
          href="/deliveries"
          ctaLabel="Deliveries"
        >
          <div className="space-y-3">
            <div className="flex gap-2.5">
              <ArrowRight className="h-4 w-4 text-primary-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900">1. Mark Ready (DRAFT → READY):</strong>{' '}
                Locks the plan&apos;s vehicle, driver, and delivery manifest before departure. Revert to Draft anytime prior to dispatch to edit.
              </div>
            </div>
            <div className="flex gap-2.5">
              <ArrowRight className="h-4 w-4 text-primary-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900">2. Dispatch (READY → DISPATCHED):</strong>{' '}
                Transitions assigned deliveries to In Transit and marks the truck In Use and driver On Trip.
              </div>
            </div>
            <div className="flex gap-2.5">
              <Navigation className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-900">3. Complete & Track (DISPATCHED → COMPLETED):</strong>{' '}
                Marks deliveries Delivered, releases fleet resources back to Available, and publishes milestones to any shareable customer tracking link on the delivery page.
              </div>
            </div>
          </div>
        </GuideSection>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary-500" />
            How are weights validated?
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Delivery weights (from cargo items or manual entry in kg) are summed on every load plan edit and enforced transactionally against the assigned truck&apos;s capacity.
          </p>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary-500" />
            Is workspace data isolated?
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Yes. Every record query and mutation is strictly scoped by your authenticated company ID and protected by tenant isolation boundaries.
          </p>
        </Card>
      </div>
    </div>
  );
}
