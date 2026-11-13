'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Package,
  ClipboardList,
  Truck,
  Users,
  Sparkles,
  FileUp,
  LayoutDashboard,
  Calendar,
  Settings,
  Plus,
  ArrowRight,
  Loader2,
  X,
  SlidersHorizontal,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface SearchResultResponse {
  deliveries: {
    id: string;
    customerName: string;
    deliveryAddress: string;
    status: string;
    weight: number;
  }[];
  loadPlans: {
    id: string;
    status: string;
    date: string;
    truck?: { name: string; plateNumber: string } | null;
    driver?: { name: string } | null;
  }[];
  trucks: {
    id: string;
    name: string;
    plateNumber: string;
    type: string;
    status: string;
    weightCapacity: number;
  }[];
  drivers: {
    id: string;
    name: string;
    phone?: string | null;
    licenseNumber?: string | null;
    status: string;
  }[];
}

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

const STATIC_COMMANDS: PaletteItem[] = [
  {
    id: 'act-new-load',
    group: 'Quick Actions',
    label: 'Create Load Plan',
    sublabel: 'Start a new draft load plan and assign truck & driver',
    href: '/loads/new',
    icon: <Plus className="h-4 w-4 text-primary-600" />,
  },
  {
    id: 'act-new-delivery',
    group: 'Quick Actions',
    label: 'Create Delivery',
    sublabel: 'Register a new customer delivery order',
    href: '/deliveries/new',
    icon: <Plus className="h-4 w-4 text-primary-600" />,
  },
  {
    id: 'act-recommend',
    group: 'Quick Actions',
    label: 'Run Truck & Driver Recommendations',
    sublabel: 'Score available vehicles and drivers for pending deliveries',
    href: '/loads/recommend',
    icon: <Sparkles className="h-4 w-4 text-primary-600" />,
  },
  {
    id: 'act-optimize',
    group: 'Quick Actions',
    label: 'Open Multi-Truck Load Optimizer',
    sublabel: 'Automatically pack pending deliveries across available fleet',
    href: '/loads/optimize',
    icon: <SlidersHorizontal className="h-4 w-4 text-primary-600" />,
  },
  {
    id: 'act-new-truck',
    group: 'Quick Actions',
    label: 'Add Fleet Truck',
    sublabel: 'Register a new vehicle with plate and weight capacity',
    href: '/trucks/new',
    icon: <Truck className="h-4 w-4 text-gray-500" />,
  },
  {
    id: 'act-new-driver',
    group: 'Quick Actions',
    label: 'Add Driver',
    sublabel: 'Add a new driver to your company roster',
    href: '/drivers/new',
    icon: <Users className="h-4 w-4 text-gray-500" />,
  },
  {
    id: 'act-import',
    group: 'Quick Actions',
    label: 'Import CSV Data',
    sublabel: 'Bulk import deliveries, trucks, or drivers from CSV',
    href: '/import',
    icon: <FileUp className="h-4 w-4 text-gray-500" />,
  },
  {
    id: 'wf-exceptions',
    group: 'Dispatcher Shortcuts',
    label: 'Open Operational Exception Center',
    sublabel: 'Review overdue orders, missing drivers, and capacity blockers',
    href: '/dashboard#exception-center',
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  },
  {
    id: 'wf-pending-del',
    group: 'Dispatcher Shortcuts',
    label: 'Open Pending Deliveries Queue',
    sublabel: 'View unassigned customer orders awaiting load plan allocation',
    href: '/deliveries?status=PENDING',
    icon: <Clock className="h-4 w-4 text-amber-600" />,
  },
  {
    id: 'wf-overdue-del',
    group: 'Dispatcher Shortcuts',
    label: 'Open Overdue & Due Soon Deliveries',
    sublabel: 'Filter pending orders scheduled for today, tomorrow, or past due',
    href: '/deliveries?status=PENDING&schedule=overdue',
    icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
  },
  {
    id: 'wf-ready-plans',
    group: 'Dispatcher Shortcuts',
    label: 'Open Ready for Dispatch Plans',
    sublabel: 'View locked load plans verified and ready to put on the road',
    href: '/loads?status=READY',
    icon: <CheckCircle2 className="h-4 w-4 text-sky-600" />,
  },
  {
    id: 'wf-avail-trucks',
    group: 'Dispatcher Shortcuts',
    label: 'Open Available Fleet Trucks',
    sublabel: 'Filter vehicle roster to trucks ready for immediate assignment',
    href: '/trucks?status=AVAILABLE',
    icon: <Truck className="h-4 w-4 text-emerald-600" />,
  },
  {
    id: 'nav-dashboard',
    group: 'Navigation',
    label: 'Operations Dashboard',
    sublabel: 'Fleet overview, active load plans, and pending queue',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4 text-gray-500" />,
  },
  {
    id: 'nav-dispatch',
    group: 'Navigation',
    label: 'Dispatch Board',
    sublabel: 'Central dispatch workspace, resource availability, and conflict detection',
    href: '/dispatch',
    icon: <ClipboardList className="h-4 w-4 text-primary-600" />,
  },
  {
    id: 'nav-dispatch-calendar',
    group: 'Navigation',
    label: 'Dispatch Calendar',
    sublabel: '7-day and daily dispatch scheduling calendar with readiness status',
    href: '/dispatch/calendar',
    icon: <Calendar className="h-4 w-4 text-primary-600" />,
  },
  {
    id: 'nav-loads',
    group: 'Navigation',
    label: 'Load Plans Workspace',
    sublabel: 'Manage DRAFT, READY, DISPATCHED, and COMPLETED plans',
    href: '/loads',
    icon: <ClipboardList className="h-4 w-4 text-gray-500" />,
  },
  {
    id: 'nav-deliveries',
    group: 'Navigation',
    label: 'Deliveries Workspace',
    sublabel: 'Track and filter all customer deliveries',
    href: '/deliveries',
    icon: <Package className="h-4 w-4 text-gray-500" />,
  },
  {
    id: 'nav-trucks',
    group: 'Navigation',
    label: 'Fleet — Trucks',
    sublabel: 'Manage vehicles, capacities, and availability',
    href: '/trucks',
    icon: <Truck className="h-4 w-4 text-gray-500" />,
  },
  {
    id: 'nav-drivers',
    group: 'Navigation',
    label: 'Fleet — Drivers',
    sublabel: 'Manage driver roster and trip status',
    href: '/drivers',
    icon: <Users className="h-4 w-4 text-gray-500" />,
  },
  {
    id: 'nav-schedule',
    group: 'Navigation',
    label: 'Dispatch Schedule',
    sublabel: 'Chronological view of planned and active load plans',
    href: '/schedule',
    icon: <Calendar className="h-4 w-4 text-gray-500" />,
  },
  {
    id: 'nav-settings',
    group: 'Navigation',
    label: 'Company Settings',
    sublabel: 'Configure company profile, timezone, and weight units',
    href: '/settings',
    icon: <Settings className="h-4 w-4 text-gray-500" />,
  },
];

export function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(null);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data: SearchResultResponse = await res.json();
          setResults(data);
        }
      } catch {
        // Ignore abort errors
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];
    const q = query.trim().toLowerCase();

    if (results) {
      for (const lp of results.loadPlans) {
        list.push({
          id: `lp-${lp.id}`,
          group: 'Load Plans',
          label: `Plan #${lp.id.slice(-6).toUpperCase()} — ${lp.truck?.name || 'Unassigned Truck'}`,
          sublabel: `${new Date(lp.date).toLocaleDateString()} • Driver: ${lp.driver?.name || 'Unassigned'}`,
          href: `/loads/${lp.id}`,
          icon: <ClipboardList className="h-4 w-4 text-primary-600" />,
          badge: <StatusBadge domain="loadPlan" status={lp.status} />,
        });
      }
      for (const d of results.deliveries) {
        list.push({
          id: `del-${d.id}`,
          group: 'Deliveries',
          label: d.customerName,
          sublabel: `${d.deliveryAddress} • ${d.weight.toLocaleString()} kg`,
          href: `/deliveries/${d.id}`,
          icon: <Package className="h-4 w-4 text-sky-600" />,
          badge: <StatusBadge domain="delivery" status={d.status} />,
        });
      }
      for (const t of results.trucks) {
        list.push({
          id: `trk-${t.id}`,
          group: 'Trucks',
          label: `${t.name} (${t.plateNumber})`,
          sublabel: `${t.type} • ${t.weightCapacity.toLocaleString()} kg capacity`,
          href: `/trucks/${t.id}`,
          icon: <Truck className="h-4 w-4 text-emerald-600" />,
          badge: <StatusBadge domain="truck" status={t.status} />,
        });
      }
      for (const dr of results.drivers) {
        list.push({
          id: `drv-${dr.id}`,
          group: 'Drivers',
          label: dr.name,
          sublabel: `${dr.phone || 'No phone'} • License ${dr.licenseNumber || 'N/A'}`,
          href: `/drivers/${dr.id}`,
          icon: <Users className="h-4 w-4 text-amber-600" />,
          badge: <StatusBadge domain="driver" status={dr.status} />,
        });
      }
    }

    const filteredStatic = q
      ? STATIC_COMMANDS.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (item.sublabel && item.sublabel.toLowerCase().includes(q))
        )
      : STATIC_COMMANDS;

    return [...list, ...filteredStatic];
  }, [query, results]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          items.length > 0 ? (prev - 1 + items.length) % items.length : 0
        );
      } else if (e.key === 'Enter' && items[activeIndex]) {
        e.preventDefault();
        const target = items[activeIndex];
        onClose();
        router.push(target.href);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, activeIndex, onClose, router]);

  if (!isOpen) return null;

  // Group items while preserving index for keyboard navigation
  const groups: { name: string; entries: { item: PaletteItem; index: number }[] }[] = [];
  items.forEach((item, index) => {
    let group = groups.find((g) => g.name === item.group);
    if (!group) {
      group = { name: item.group, entries: [] };
      groups.push(group);
    }
    group.entries.push({ item, index });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4">
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search and command palette"
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-slide-up"
      >
        {/* Search input bar */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary-600" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deliveries, load plans, trucks, drivers, or jump to a workspace..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
              aria-label="Clear search query"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {groups.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No matching records or commands found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.name} className="mb-3 last:mb-0">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {group.name}
                </div>
                <div className="space-y-0.5">
                  {group.entries.map(({ item, index }) => {
                    const isSelected = index === activeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          onClose();
                          router.push(item.href);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer',
                          isSelected ? 'bg-primary-50/80 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-xs">
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {item.label}
                            </p>
                            {item.sublabel && (
                              <p className="truncate text-xs text-gray-500">
                                {item.sublabel}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {item.badge}
                          <ArrowRight
                            className={cn(
                              'h-3.5 w-3.5 transition-transform',
                              isSelected
                                ? 'translate-x-0.5 text-primary-600'
                                : 'text-gray-300'
                            )}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
          <div className="flex items-center gap-3">
            <span>
              <strong className="font-semibold text-gray-700">↑↓</strong> Navigate
            </span>
            <span>
              <strong className="font-semibold text-gray-700">↵</strong> Open
            </span>
            <span>
              <strong className="font-semibold text-gray-700">ESC</strong> Close
            </span>
          </div>
          <span>Company-scoped search</span>
        </div>
      </div>
    </div>
  );
}
