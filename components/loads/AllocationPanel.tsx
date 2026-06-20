'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Plus, Minus, ArrowUp, ArrowDown, Lock, AlertTriangle, Search, X, Filter, CheckSquare, Square, ChevronsRight, ChevronsLeft, Package } from 'lucide-react';
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
  { value: 'this_week', label: 'Scheduled This Week' },
  { value: 'no_date', label: 'No Scheduled Date' },
];

interface AllocationPanelProps {
  loadPlanId: string;
  initialUnassigned: DeliveryItem[];
  initialAssigned: DeliveryItem[];
  truckCapacity: number;
  isFinalized?: boolean;
}

/**
 * Check if a delivery matches the given date filter.
 */
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

/**
 * Check if a delivery matches the search query across customer name,
 * pickup address, and delivery address.
 */
function matchesSearch(item: DeliveryItem, query: string): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  return (
    item.customerName.toLowerCase().includes(lowerQuery) ||
    item.pickupAddress.toLowerCase().includes(lowerQuery) ||
    item.deliveryAddress.toLowerCase().includes(lowerQuery)
  );
}

export function AllocationPanel({ loadPlanId, initialUnassigned, initialAssigned, truckCapacity, isFinalized = false }: AllocationPanelProps) {
  const router = useRouter();
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [assigned, setAssigned] = useState(initialAssigned);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dateWarnings, setDateWarnings] = useState<{ deliveryId: string; customerName: string; message: string }[]>([]);

  // ── Search & Filter state ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // ── Multi-select state ─────────────────────────────────────────────────────
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());
  const [selectedAssigned, setSelectedAssigned] = useState<Set<string>>(new Set());

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
  }, 200);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSetQuery(value);
  }, [debouncedSetQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  // ── Memoized filtered list ─────────────────────────────────────────────────
  const filteredUnassigned = useMemo(() => {
    return unassigned.filter(item =>
      matchesSearch(item, debouncedQuery) && matchesDateFilter(item, dateFilter)
    );
  }, [unassigned, debouncedQuery, dateFilter]);

  // Prune selections to only include items that are currently visible
  const visibleSelectedUnassigned = useMemo(() => {
    const visibleIds = new Set(filteredUnassigned.map(i => i.id));
    const pruned = new Set<string>();
    selectedUnassigned.forEach(id => { if (visibleIds.has(id)) pruned.add(id); });
    return pruned;
  }, [filteredUnassigned, selectedUnassigned]);

  const hasActiveFilters = debouncedQuery.length > 0 || dateFilter !== 'all';

  // ── Capacity calculations ──────────────────────────────────────────────────
  const currentWeight = useMemo(
    () => assigned.reduce((sum, item) => sum + item.weight, 0),
    [assigned]
  );
  const percentFull = Math.min((currentWeight / truckCapacity) * 100, 100);
  const isOverweight = currentWeight > truckCapacity;

  // ── Selection handlers ─────────────────────────────────────────────────────
  const toggleUnassignedSelection = useCallback((id: string) => {
    setSelectedUnassigned(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAssignedSelection = useCallback((id: string) => {
    setSelectedAssigned(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllUnassigned = useCallback(() => {
    const allVisibleIds = filteredUnassigned.map(i => i.id);
    const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedUnassigned.has(id));
    if (allSelected) {
      // Deselect all visible
      setSelectedUnassigned(prev => {
        const next = new Set(prev);
        allVisibleIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // Select all visible
      setSelectedUnassigned(prev => {
        const next = new Set(prev);
        allVisibleIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [filteredUnassigned, selectedUnassigned]);

  const toggleSelectAllAssigned = useCallback(() => {
    const allIds = assigned.map(i => i.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedAssigned.has(id));
    if (allSelected) {
      setSelectedAssigned(new Set());
    } else {
      setSelectedAssigned(new Set(allIds));
    }
  }, [assigned, selectedAssigned]);

  // ── Assignment handlers ────────────────────────────────────────────────────
  function handleAssign(item: DeliveryItem) {
    if (isFinalized) return;
    setUnassigned(prev => prev.filter(i => i.id !== item.id));
    setAssigned(prev => [...prev, item]);
    // Clear this item from selections if present
    setSelectedUnassigned(prev => {
      if (!prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }

  function handleRemove(item: DeliveryItem) {
    if (isFinalized) return;
    setAssigned(prev => prev.filter(i => i.id !== item.id));
    setUnassigned(prev => [...prev, item]);
    // Clear this item from selections if present
    setSelectedAssigned(prev => {
      if (!prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }

  // ── Bulk assignment handlers ───────────────────────────────────────────────
  function handleBulkAssign() {
    if (isFinalized || visibleSelectedUnassigned.size === 0) return;
    const idsToAssign = visibleSelectedUnassigned;
    const itemsToAssign = unassigned.filter(i => idsToAssign.has(i.id));
    setUnassigned(prev => prev.filter(i => !idsToAssign.has(i.id)));
    setAssigned(prev => [...prev, ...itemsToAssign]);
    setSelectedUnassigned(prev => {
      const next = new Set(prev);
      idsToAssign.forEach(id => next.delete(id));
      return next;
    });
  }

  function handleBulkRemove() {
    if (isFinalized || selectedAssigned.size === 0) return;
    const idsToRemove = selectedAssigned;
    const itemsToRemove = assigned.filter(i => idsToRemove.has(i.id));
    setAssigned(prev => prev.filter(i => !idsToRemove.has(i.id)));
    setUnassigned(prev => [...prev, ...itemsToRemove]);
    setSelectedAssigned(new Set());
  }

  function handleMoveUp(index: number) {
    if (isFinalized || index === 0) return;
    setAssigned(prev => {
      const newArr = [...prev];
      const temp = newArr[index];
      newArr[index] = newArr[index - 1];
      newArr[index - 1] = temp;
      return newArr;
    });
  }

  function handleMoveDown(index: number) {
    if (isFinalized || index === assigned.length - 1) return;
    setAssigned(prev => {
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
      const assignedDeliveryIds = assigned.map(a => a.id);
      const res = await fetch(`/api/loads/${loadPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: assignedDeliveryIds })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.error || 'Failed to save plan');
        return;
      }

      const data = await res.json();

      // Surface non-blocking date warnings
      if (data._warnings && Array.isArray(data._warnings) && data._warnings.length > 0) {
        setDateWarnings(data._warnings);
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // C-4: Re-sync with server to prevent stale state
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save load plan');
    } finally {
      setSaving(false);
    }
  }

  // ── Derived selection state ────────────────────────────────────────────────
  const allUnassignedSelected = filteredUnassigned.length > 0 && filteredUnassigned.every(i => selectedUnassigned.has(i.id));
  const someUnassignedSelected = filteredUnassigned.some(i => selectedUnassigned.has(i.id));
  const allAssignedSelected = assigned.length > 0 && assigned.every(i => selectedAssigned.has(i.id));
  const someAssignedSelected = assigned.some(i => selectedAssigned.has(i.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div>
          {isFinalized && (
            <div className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              <Lock className="h-4 w-4" />
              Load plan is locked and cannot be edited.
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm font-medium text-emerald-600 animate-in fade-in duration-300">
              ✓ Plan saved
            </span>
          )}
          {!isFinalized && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Plan'}
            </button>
          )}
        </div>
      </div>

      {/* Date Mismatch Warnings */}
      {dateWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-1">
            <AlertTriangle className="h-4 w-4" />
            Schedule Mismatch
          </div>
          <ul className="space-y-1">
            {dateWarnings.map(w => (
              <li key={w.deliveryId} className="text-xs text-amber-700">
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-250px)] min-h-[500px]">
        {/* Unassigned Panel */}
        <Card className="flex flex-col h-full bg-gray-50/50">
          <div className="p-4 border-b border-gray-200 bg-white rounded-t-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Unassigned Deliveries</h3>
                <p className="text-sm text-gray-500">
                  {hasActiveFilters
                    ? `${filteredUnassigned.length} of ${unassigned.length} deliveries match`
                    : `${unassigned.length} items available`}
                </p>
              </div>
              <button
                onClick={() => setShowFilters(prev => !prev)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  showFilters || dateFilter !== 'all'
                    ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
                title="Toggle filters"
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {dateFilter !== 'all' && (
                  <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                id="allocation-search"
                type="text"
                placeholder="Search by customer, pickup, or delivery address…"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter pills */}
            {showFilters && (
              <div className="flex flex-wrap gap-1.5 animate-fade-in">
                {DATE_FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDateFilter(opt.value)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-all duration-150",
                      dateFilter === opt.value
                        ? "bg-primary-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Bulk Actions Bar — Unassigned */}
            {!isFinalized && filteredUnassigned.length > 0 && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  onClick={toggleSelectAllUnassigned}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  title={allUnassignedSelected ? 'Deselect all' : 'Select all visible'}
                >
                  {allUnassignedSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary-600" />
                  ) : someUnassignedSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary-400" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  {allUnassignedSelected ? 'Deselect all' : 'Select all'}
                </button>
                {visibleSelectedUnassigned.size > 0 && (
                  <button
                    onClick={handleBulkAssign}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                    Assign {visibleSelectedUnassigned.size} selected
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[150px]">
            {filteredUnassigned.map(item => {
              const isSelected = selectedUnassigned.has(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-colors",
                    isSelected && "border-primary-300 bg-primary-50/40 ring-1 ring-primary-200",
                    !isSelected && !isFinalized && "hover:border-emerald-200"
                  )}
                >
                  {/* Selection checkbox */}
                  {!isFinalized && (
                    <button
                      onClick={() => toggleUnassignedSelection(item.id)}
                      className={cn(
                        "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors",
                        isSelected
                          ? "text-primary-600"
                          : "text-gray-300 hover:text-gray-500"
                      )}
                      title={isSelected ? 'Deselect' : 'Select'}
                    >
                      {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => handleAssign(item)}
                    disabled={isFinalized || saving}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Assign to truck"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.customerName}</p>
                    <p className="text-xs text-gray-500 truncate">{item.deliveryAddress}</p>
                    {item.itemSummary && <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.itemSummary}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-100 px-2 py-1 rounded">
                      {item.weight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                    </div>
                    {item.itemCount > 0 && (
                      <span className="text-[10px] font-medium text-primary-600 whitespace-nowrap">
                        {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Empty states */}
            {filteredUnassigned.length === 0 && hasActiveFilters && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-3">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No deliveries match</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
                  Try adjusting your search or filters to find what you&apos;re looking for.
                </p>
                <button
                  onClick={() => { handleClearSearch(); setDateFilter('all'); }}
                  className="mt-3 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
            {filteredUnassigned.length === 0 && !hasActiveFilters && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-3">
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">All deliveries assigned</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
                  Every pending delivery has been allocated. Create new deliveries to add more.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Assigned Panel */}
        <Card className="flex flex-col h-full bg-white ring-1 ring-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Truck Allocation</h3>
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className={cn("font-medium", isOverweight ? "text-red-600" : "text-gray-700")}>
                  {currentWeight.toLocaleString()} / {truckCapacity.toLocaleString()} kg
                </span>
                <span className="text-gray-500">{percentFull.toFixed(1)}% Full</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-300", 
                    isOverweight ? "bg-red-500" : percentFull > 90 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(percentFull, 100)}%` }}
                />
              </div>
              {isOverweight && <p className="text-xs text-red-500 mt-1">Warning: Truck is over capacity</p>}
            </div>

            {/* Bulk Actions Bar — Assigned */}
            {!isFinalized && assigned.length > 0 && (
              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={toggleSelectAllAssigned}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  title={allAssignedSelected ? 'Deselect all' : 'Select all'}
                >
                  {allAssignedSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary-600" />
                  ) : someAssignedSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary-400" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  {allAssignedSelected ? 'Deselect all' : 'Select all'}
                </button>
                {selectedAssigned.size > 0 && (
                  <button
                    onClick={handleBulkRemove}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                    Remove {selectedAssigned.size} selected
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/30 min-h-[150px]">
            {assigned.map((item, index) => {
              const isSelected = selectedAssigned.has(item.id);
              return (
                <div key={item.id} className="relative">
                  <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-sm border-2 border-white">
                    {index + 1}
                  </div>
                  <div
                    className={cn(
                      "ml-4 flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-colors",
                      isSelected && "border-primary-300 bg-primary-50/40 ring-1 ring-primary-200",
                      !isSelected && !isFinalized && "hover:border-gray-300"
                    )}
                  >
                    {/* Selection checkbox */}
                    {!isFinalized && (
                      <button
                        onClick={() => toggleAssignedSelection(item.id)}
                        className={cn(
                          "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors",
                          isSelected
                            ? "text-primary-600"
                            : "text-gray-300 hover:text-gray-500"
                        )}
                        title={isSelected ? 'Deselect' : 'Select'}
                      >
                        {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                    )}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={isFinalized || index === 0}
                        className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={isFinalized || index === assigned.length - 1}
                        className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.customerName}</p>
                      <p className="text-xs text-gray-500 truncate">{item.deliveryAddress}</p>
                      {item.itemSummary && <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.itemSummary}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-100 px-2 py-1 rounded">
                        {item.weight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                      </div>
                      {item.itemCount > 0 && (
                        <span className="text-[10px] font-medium text-primary-600 whitespace-nowrap">
                          {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemove(item)}
                      disabled={isFinalized || saving}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors ml-1 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove from truck"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {assigned.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-3">
                  <ChevronsRight className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No deliveries allocated</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
                  Select deliveries from the left panel and assign them to this truck.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
