'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Plus, Minus, ArrowUp, ArrowDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DeliveryItem {
  id: string;
  customerName: string;
  deliveryAddress: string;
  weight: number;
  itemCount: number;
  itemSummary: string;
}

interface AllocationPanelProps {
  loadPlanId: string;
  initialUnassigned: DeliveryItem[];
  initialAssigned: DeliveryItem[];
  truckCapacity: number;
  isFinalized?: boolean;
}

export function AllocationPanel({ loadPlanId, initialUnassigned, initialAssigned, truckCapacity, isFinalized = false }: AllocationPanelProps) {
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [assigned, setAssigned] = useState(initialAssigned);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentWeight = assigned.reduce((sum, item) => sum + item.weight, 0);
  const percentFull = Math.min((currentWeight / truckCapacity) * 100, 100);
  const isOverweight = currentWeight > truckCapacity;

  function handleAssign(item: DeliveryItem) {
    if (isFinalized) return;
    setUnassigned(prev => prev.filter(i => i.id !== item.id));
    setAssigned(prev => [...prev, item]);
  }

  function handleRemove(item: DeliveryItem) {
    if (isFinalized) return;
    setAssigned(prev => prev.filter(i => i.id !== item.id));
    setUnassigned(prev => [...prev, item]);
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
    try {
      const assignedDeliveryIds = assigned.map(a => a.id);
      const res = await fetch(`/api/loads/${loadPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: assignedDeliveryIds })
      });
      
      if (!res.ok) throw new Error('Failed to save plan');
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save load plan');
    } finally {
      setSaving(false);
    }
  }

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-250px)] min-h-[500px]">
        {/* Unassigned Panel */}
        <Card className="flex flex-col h-full bg-gray-50/50">
          <div className="p-4 border-b border-gray-200 bg-white rounded-t-xl">
            <h3 className="font-semibold text-gray-900">Unassigned Deliveries</h3>
            <p className="text-sm text-gray-500">{unassigned.length} items available</p>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[150px]">
            {unassigned.map(item => (
              <div key={item.id} className={cn("flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-colors", !isFinalized && "hover:border-emerald-200")}>
                <button
                  onClick={() => handleAssign(item)}
                  disabled={isFinalized}
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
            ))}
            {unassigned.length === 0 && (
              <div className="h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-sm text-gray-400">
                No unassigned deliveries
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
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/30 min-h-[150px]">
            {assigned.map((item, index) => (
              <div key={item.id} className="relative">
                <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-sm border-2 border-white">
                  {index + 1}
                </div>
                <div className={cn("ml-4 flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-colors", !isFinalized && "hover:border-gray-300")}>
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
                    disabled={isFinalized}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors ml-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove from truck"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {assigned.length === 0 && (
              <div className="h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-sm text-gray-400 bg-white">
                No deliveries allocated
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
