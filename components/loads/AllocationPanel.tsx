'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CapacityBar } from '@/components/ui/CapacityBar';
import {
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  Lock,
  AlertTriangle,
  Search,
  X,
  Filter,
  CheckSquare,
  Square,
  ChevronsRight,
  ChevronsLeft,
  Package,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { useDebouncedCallback } from 'use-debounce';

interface DeliveryItem {
  id: string;
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
  scheduledDate: string | null;
  weight: number;
  itemCount: number;
  itemSummary: string;
}

type DateFilter = 'all' | 'today' | 'this_week' | 'no_date';

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'All Deliveries' },
  { value: 'today', label: 'Scheduled Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'no_date', label: 'Unscheduled' },
];

interface AllocationPanelProps {
  loadPlanId: string;
  initialUnassigned: DeliveryItem[];
  initialAssigned: DeliveryItem[];
  truckCapacity: number;
  isFinalized?: boolean;
}

function matchesDateFilter(item: DeliveryItem, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'no_date') return item.scheduledDate == null;
  if (item.scheduledDate == null) return false;

  const itemDate = new Date(item.scheduledDate);
  const now = new Date();

  if (filter === 'today') {
    return itemDate >= startOfDay(now) && itemDate <= endOfDay(now);
  }
  if (filter === 'this_week') {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    return itemDate >= weekStart && itemDate <= weekEnd;
  }
  return true;
}

function matchesSearch(item: DeliveryItem, query: string): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  return (
    item.customerName.toLowerCase().includes(lowerQuery) ||
    item.pickupAddress.toLowerCase().includes(lowerQuery) ||
    item.deliveryAddress.toLowerCase().includes(lowerQuery)
  );
}

export function AllocationPanel({
  loadPlanId,
  initialUnassigned,
  initialAssigned,
  truckCapacity,
  isFinalized = false,
}: AllocationPanelProps) {
  const router = useRouter();
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [assigned, setAssigned] = useState(initialAssigned);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dateWarnings, setDateWarnings] = useState<
    { deliveryId: string; customerName: string; message: string }[]
  >([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(
    new Set()
  );
  const [selectedAssigned, setSelectedAssigned] = useState<Set<string>>(
    new Set()
  );

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
  }, 200);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      debouncedSetQuery(value);
    },
    [debouncedSetQuery]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  const filteredUnassigned = useMemo(() => {
    return unassigned.filter(
      (item) =>
        matchesSearch(item, debouncedQuery) &&
        matchesDateFilter(item, dateFilter)
    );
  }, [unassigned, debouncedQuery, dateFilter]);

  const visibleSelectedUnassigned = useMemo(() => {
    const visibleIds = new Set(filteredUnassigned.map((i) => i.id));
    const pruned = new Set<string>();
    selectedUnassigned.forEach((id) => {
      if (visibleIds.has(id)) pruned.add(id);
    });
    return pruned;
  }, [filteredUnassigned, selectedUnassigned]);

  const hasActiveFilters = debouncedQuery.length > 0 || dateFilter !== 'all';

  const currentWeight = useMemo(
    () => assigned.reduce((sum, item) => sum + item.weight, 0),
    [assigned]
  );

  const selectedUnassignedWeight = useMemo(
    () =>
      filteredUnassigned
        .filter((i) => visibleSelectedUnassigned.has(i.id))
        .reduce((sum, i) => sum + i.weight, 0),
    [filteredUnassigned, visibleSelectedUnassigned]
  );

  const isDirty = useMemo(() => {
    if (assigned.length !== initialAssigned.length) return true;
    return assigned.some((item, idx) => item.id !== initialAssigned[idx]?.id);
  }, [assigned, initialAssigned]);

  const isOverweight = truckCapacity > 0 && currentWeight > truckCapacity;

  const toggleUnassignedSelection = useCallback((id: string) => {
    setSelectedUnassigned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAssignedSelection = useCallback((id: string) => {
    setSelectedAssigned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllUnassigned = useCallback(() => {
    const allVisibleIds = filteredUnassigned.map((i) => i.id);
    const allSelected =
      allVisibleIds.length > 0 &&
      allVisibleIds.every((id) => selectedUnassigned.has(id));
    if (allSelected) {
      setSelectedUnassigned((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedUnassigned((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [filteredUnassigned, selectedUnassigned]);

  const toggleSelectAllAssigned = useCallback(() => {
    const allIds = assigned.map((i) => i.id);
    const allSelected =
      allIds.length > 0 && allIds.every((id) => selectedAssigned.has(id));
    if (allSelected) {
      setSelectedAssigned(new Set());
    } else {
      setSelectedAssigned(new Set(allIds));
    }
  }, [assigned, selectedAssigned]);

  function handleAssign(item: DeliveryItem) {
    if (isFinalized) return;
    setUnassigned((prev) => prev.filter((i) => i.id !== item.id));
    setAssigned((prev) => [...prev, item]);
    setSelectedUnassigned((prev) => {
      if (!prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }

  function handleRemove(item: DeliveryItem) {
    if (isFinalized) return;
    setAssigned((prev) => prev.filter((i) => i.id !== item.id));
    setUnassigned((prev) => [...prev, item]);
    setSelectedAssigned((prev) => {
      if (!prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }

  function handleBulkAssign() {
    if (isFinalized || visibleSelectedUnassigned.size === 0) return;
    const idsToAssign = visibleSelectedUnassigned;
    const itemsToAssign = unassigned.filter((i) => idsToAssign.has(i.id));
    setUnassigned((prev) => prev.filter((i) => !idsToAssign.has(i.id)));
    setAssigned((prev) => [...prev, ...itemsToAssign]);
    setSelectedUnassigned((prev) => {
      const next = new Set(prev);
      idsToAssign.forEach((id) => next.delete(id));
      return next;
    });
  }

  function handleBulkRemove() {
    if (isFinalized || selectedAssigned.size === 0) return;
    const idsToRemove = selectedAssigned;
    const itemsToRemove = assigned.filter((i) => idsToRemove.has(i.id));
    setAssigned((prev) => prev.filter((i) => !idsToRemove.has(i.id)));
    setUnassigned((prev) => [...prev, ...itemsToRemove]);
    setSelectedAssigned(new Set());
  }

  function handleMoveUp(index: number) {
    if (isFinalized || index === 0) return;
    setAssigned((prev) => {
      const newArr = [...prev];
      const temp = newArr[index];
      newArr[index] = newArr[index - 1];
      newArr[index - 1] = temp;
      return newArr;
    });
  }

  function handleMoveDown(index: number) {
    if (isFinalized || index === assigned.length - 1) return;
    setAssigned((prev) => {
      const newArr = [...prev];
      const temp = newArr[index];
      newArr[index] = newArr[index + 1];
      newArr[index + 1] = temp;
      return newArr;
    });
  }

  async function handleSave() {
    if (isFinalized) return;
    setSaving(true);
    setSaved(false);
    setDateWarnings([]);
    try {
      const assignedDeliveryIds = assigned.map((a) => a.id);
      const res = await fetch(`/api/loads/${loadPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: assignedDeliveryIds }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.error || 'Failed to save load plan');
        return;
      }

      const data = await res.json();

      if (
        data._warnings &&
        Array.isArray(data._warnings) &&
        data._warnings.length > 0
      ) {
        setDateWarnings(data._warnings);
      }

      toast.success('Load plan allocation saved');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save load plan');
    } finally {
      setSaving(false);
    }
  }

  const allUnassignedSelected =
    filteredUnassigned.length > 0 &&
    filteredUnassigned.every((i) => selectedUnassigned.has(i.id));
  const someUnassignedSelected = filteredUnassigned.some((i) =>
    selectedUnassigned.has(i.id)
  );
  const allAssignedSelected =
    assigned.length > 0 &&
    assigned.every((i) => selectedAssigned.has(i.id));
  const someAssignedSelected = assigned.some((i) =>
    selectedAssigned.has(i.id)
  );

  return (
    <div className="space-y-4">
      {/* Allocation Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          {isFinalized ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              Allocation locked — only DRAFT plans can be edited
            </div>
          ) : (
            <div className="text-xs text-gray-600">
              <span className="font-semibold text-gray-900">
                Interactive Allocation Workspace:
              </span>{' '}
              Move deliveries between the unassigned queue and this truck, reorder
              stops, then save changes.
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Allocation saved
            </span>
          )}
          {isDirty && !isFinalized && !saved && (
            <span className="text-xs font-medium text-amber-600">
              Unsaved changes
            </span>
          )}
          {!isFinalized && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saving}
            >
              <Save className="h-3.5 w-3.5" />
              Save Allocation
            </Button>
          )}
        </div>
      </div>

      {/* Date Mismatch Warnings */}
      {dateWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Schedule Date Mismatch Notice
          </div>
          <ul className="space-y-1 pl-6 list-disc">
            {dateWarnings.map((w) => (
              <li key={w.deliveryId} className="text-xs text-amber-700">
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Two-Column Allocation Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: Unassigned Deliveries Pool */}
        <Card className="flex flex-col h-[560px] bg-gray-50/40">
          <div className="space-y-3 border-b border-gray-200 bg-white p-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Unassigned Pending Deliveries
                </h3>
                <p className="text-xs text-gray-500">
                  {hasActiveFilters
                    ? `Showing ${filteredUnassigned.length} of ${unassigned.length} pending deliveries`
                    : `${unassigned.length} pending deliveries available`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  showFilters || dateFilter !== 'all'
                    ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Date Filter
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="allocation-search"
                type="text"
                placeholder="Search customer, pickup, or destination..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-xs text-gray-900 placeholder:text-gray-400 focus:border-primary-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-primary-500/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-1.5">
                {DATE_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDateFilter(opt.value)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                      dateFilter === opt.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {!isFinalized && filteredUnassigned.length > 0 && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={toggleSelectAllUnassigned}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                  {allUnassignedSelected || someUnassignedSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary-600" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-gray-400" />
                  )}
                  {allUnassignedSelected ? 'Deselect all' : 'Select all visible'}
                </button>
                {visibleSelectedUnassigned.size > 0 && (
                  <Button
                    type="button"
                    variant="success"
                    size="xs"
                    onClick={handleBulkAssign}
                    disabled={saving}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                    Assign {visibleSelectedUnassigned.size} (
                    {selectedUnassignedWeight.toLocaleString()} kg)
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {filteredUnassigned.map((item) => {
              const isSelected = selectedUnassigned.has(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border bg-white p-3 shadow-2xs transition-colors',
                    isSelected
                      ? 'border-primary-400 bg-primary-50/30 ring-1 ring-primary-200'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  {!isFinalized && (
                    <button
                      type="button"
                      onClick={() => toggleUnassignedSelection(item.id)}
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors cursor-pointer',
                        isSelected
                          ? 'text-primary-600'
                          : 'text-gray-300 hover:text-gray-500'
                      )}
                      aria-label={isSelected ? 'Deselect delivery' : 'Select delivery'}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  )}

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/deliveries/${item.id}`}
                      className="truncate block text-xs font-semibold text-gray-900 hover:text-primary-600"
                    >
                      {item.customerName}
                    </Link>
                    <p className="truncate text-xs text-gray-500">
                      {item.deliveryAddress}
                    </p>
                    {item.itemSummary && (
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        {item.itemSummary}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800 tabular-nums">
                      {item.weight.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}{' '}
                      kg
                    </span>
                    {item.scheduledDate && (
                      <span className="text-[10px] text-gray-400 tabular-nums">
                        {new Date(item.scheduledDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {!isFinalized && (
                    <button
                      type="button"
                      onClick={() => handleAssign(item)}
                      disabled={saving}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 cursor-pointer"
                      title="Assign to truck"
                      aria-label={`Assign ${item.customerName} to truck`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {filteredUnassigned.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400">
                  <Package className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-gray-800">
                  {hasActiveFilters
                    ? 'No deliveries match your filter'
                    : 'All pending deliveries allocated'}
                </p>
                <p className="mt-1 max-w-xs text-xs text-gray-500">
                  {hasActiveFilters
                    ? 'Clear your search or date filter to view all unassigned deliveries.'
                    : 'There are no unassigned PENDING deliveries remaining in your queue.'}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Right: Truck Manifest (Assigned Stops) */}
        <Card className="flex flex-col h-[560px] bg-white">
          <div className="space-y-3 border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Truck Manifest ({assigned.length}{' '}
                  {assigned.length === 1 ? 'Stop' : 'Stops'})
                </h3>
                <p className="text-xs text-gray-500">
                  Ordered stop sequence for this load plan
                </p>
              </div>
              {isOverweight && (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  Over Capacity
                </span>
              )}
            </div>

            <CapacityBar
              current={Math.round(currentWeight)}
              max={truckCapacity}
              size="sm"
            />

            {!isFinalized && assigned.length > 0 && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={toggleSelectAllAssigned}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                  {allAssignedSelected || someAssignedSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary-600" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-gray-400" />
                  )}
                  {allAssignedSelected ? 'Deselect all' : 'Select all stops'}
                </button>
                {selectedAssigned.size > 0 && (
                  <Button
                    type="button"
                    variant="danger"
                    size="xs"
                    onClick={handleBulkRemove}
                    disabled={saving}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                    Remove {selectedAssigned.size} selected
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50/30 p-3.5 space-y-2.5">
            {assigned.map((item, index) => {
              const isSelected = selectedAssigned.has(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border bg-white p-3 shadow-2xs transition-colors',
                    isSelected
                      ? 'border-primary-400 bg-primary-50/30 ring-1 ring-primary-200'
                      : 'border-gray-200'
                  )}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-bold text-white tabular-nums">
                    {index + 1}
                  </div>

                  {!isFinalized && (
                    <button
                      type="button"
                      onClick={() => toggleAssignedSelection(item.id)}
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors cursor-pointer',
                        isSelected
                          ? 'text-primary-600'
                          : 'text-gray-300 hover:text-gray-500'
                      )}
                      aria-label={isSelected ? 'Deselect stop' : 'Select stop'}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  )}

                  {!isFinalized && (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="flex h-4 w-4 items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 cursor-pointer"
                        title="Move stop earlier"
                      >
                        <ArrowUp className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === assigned.length - 1}
                        className="flex h-4 w-4 items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 cursor-pointer"
                        title="Move stop later"
                      >
                        <ArrowDown className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/deliveries/${item.id}`}
                      className="truncate block text-xs font-semibold text-gray-900 hover:text-primary-600"
                    >
                      {item.customerName}
                    </Link>
                    <p className="truncate text-xs text-gray-500">
                      {item.deliveryAddress}
                    </p>
                    {item.itemSummary && (
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        {item.itemSummary}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800 tabular-nums">
                      {item.weight.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}{' '}
                      kg
                    </span>
                  </div>

                  {!isFinalized && (
                    <button
                      type="button"
                      onClick={() => handleRemove(item)}
                      disabled={saving}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-40 cursor-pointer"
                      title="Remove from truck"
                      aria-label={`Remove ${item.customerName} from truck`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {assigned.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400">
                  <ChevronsRight className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-gray-800">
                  No deliveries allocated to this truck
                </p>
                <p className="mt-1 max-w-xs text-xs text-gray-500">
                  Click the + button next to any pending delivery on the left to
                  add it to this truck&apos;s manifest.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
