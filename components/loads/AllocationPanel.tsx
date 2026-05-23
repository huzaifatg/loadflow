'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/Card';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logToServer } from '@/app/actions/log';

interface DeliveryItem {
  id: string;
  customerName: string;
  deliveryAddress: string;
  weight: number;
}

interface AllocationPanelProps {
  loadPlanId: string;
  initialUnassigned: DeliveryItem[];
  initialAssigned: DeliveryItem[];
  truckCapacity: number;
}

function SortableItem({ item }: { item: DeliveryItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm',
        isDragging && 'opacity-50 border-primary-500'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab hover:text-gray-900 text-gray-400 touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.customerName}</p>
        <p className="text-xs text-gray-500 truncate">{item.deliveryAddress}</p>
      </div>
      <div className="text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-100 px-2 py-1 rounded">
        {item.weight.toLocaleString()} lbs
      </div>
    </div>
  );
}

export function AllocationPanel({ loadPlanId, initialUnassigned, initialAssigned, truckCapacity }: AllocationPanelProps) {
  const router = useRouter();
  
  // Unified state dictionary prevents race conditions where an item is duplicated or lost
  const [items, setItems] = useState<{ unassigned: DeliveryItem[], assigned: DeliveryItem[] }>({
    unassigned: initialUnassigned,
    assigned: initialAssigned,
  });
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { setNodeRef: setUnassignedRef } = useDroppable({ id: 'unassigned-container' });
  const { setNodeRef: setAssignedRef } = useDroppable({ id: 'assigned-container' });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const currentWeight = items.assigned.reduce((sum, item) => sum + item.weight, 0);
  const percentFull = Math.min((currentWeight / truckCapacity) * 100, 100);
  const isOverweight = currentWeight > truckCapacity;

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    setActiveId(activeId);
    
    // Find container to log
    const activeContainer = items.unassigned.find(i => i.id === activeId) ? 'unassigned' : 
                            items.assigned.find(i => i.id === activeId) ? 'assigned' : 'unknown';
                            
    logToServer('onDragStart', {
      activeId,
      activeContainer,
      assignedCount: items.assigned.length,
      unassignedCount: items.unassigned.length
    });
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    const overId = over?.id ? String(over.id) : null;
    const activeId = String(active.id);

    logToServer('onDragOver (raw)', { activeId, overId });

    if (!overId || activeId === overId) {
      logToServer('onDragOver (abort)', { reason: 'No overId or active === over' });
      return;
    }

    setItems((prev) => {
      // Find the containers based purely on current state representation
      const activeContainer = prev.unassigned.find(i => i.id === activeId) ? 'unassigned' : 
                              prev.assigned.find(i => i.id === activeId) ? 'assigned' : null;

      const overContainer = prev.unassigned.find(i => i.id === overId) ? 'unassigned' : 
                            prev.assigned.find(i => i.id === overId) ? 'assigned' : 
                            overId === 'unassigned-container' ? 'unassigned' : 
                            overId === 'assigned-container' ? 'assigned' : null;

      logToServer('onDragOver (state)', { activeId, overId, activeContainer, overContainer });

      if (!activeContainer || !overContainer || activeContainer === overContainer) {
        logToServer('onDragOver (abort)', { reason: 'Same container or null', activeContainer, overContainer });
        return prev;
      }

      const activeItem = prev[activeContainer].find(i => i.id === activeId)!;
      const overIndex = prev[overContainer].findIndex(i => i.id === overId);
      
      // If dropping onto an empty container, place it at the end
      const newIndex = overIndex >= 0 ? overIndex : prev[overContainer].length;

      logToServer('onDragOver (move)', { 
        activeId, 
        from: activeContainer, 
        to: overContainer, 
        newIndex 
      });

      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter(i => i.id !== activeId),
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          activeItem,
          ...prev[overContainer].slice(newIndex)
        ]
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    const activeId = String(active.id);
    const overId = over?.id ? String(over.id) : null;

    logToServer('onDragEnd (raw)', { activeId, overId });

    if (!over) {
      logToServer('onDragEnd (abort)', { reason: 'No over element' });
      return;
    }
    
    setItems((prev) => {
      const activeContainer = prev.unassigned.find(i => i.id === activeId) ? 'unassigned' : 
                              prev.assigned.find(i => i.id === activeId) ? 'assigned' : null;

      const overContainer = prev.unassigned.find(i => i.id === overId) ? 'unassigned' : 
                            prev.assigned.find(i => i.id === overId) ? 'assigned' : 
                            overId === 'unassigned-container' ? 'unassigned' : 
                            overId === 'assigned-container' ? 'assigned' : null;

      logToServer('onDragEnd (state)', { activeId, overId, activeContainer, overContainer });

      if (!activeContainer || !overContainer || activeContainer !== overContainer) {
        logToServer('onDragEnd (abort)', { reason: 'Different containers or null' });
        return prev;
      }

      const oldIndex = prev[activeContainer].findIndex(i => i.id === activeId);
      const newIndex = prev[activeContainer].findIndex(i => i.id === overId);

      logToServer('onDragEnd (reorder)', { activeContainer, oldIndex, newIndex });

      // Guard against passing -1 to arrayMove if dropping over an empty container
      if (oldIndex !== newIndex && newIndex >= 0) {
        logToServer('onDragEnd (commit)', { activeContainer, oldIndex, newIndex });
        return {
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex)
        };
      }

      return prev;
    });
  }

  const activeItem = activeId ? [...items.unassigned, ...items.assigned].find(i => i.id === activeId) : null;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const assignedDeliveryIds = items.assigned.map(a => a.id);
      const res = await fetch(`/api/loads/${loadPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: assignedDeliveryIds })
      });
      
      if (!res.ok) throw new Error('Failed to save plan');
      
      setSaved(true);
      router.refresh(); // Crucial synchronization step
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save load plan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center gap-3">
        {saved && (
          <span className="text-sm font-medium text-emerald-600 animate-in fade-in duration-300">
            ✓ Plan saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Plan'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-250px)] min-h-[500px]">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Unassigned Panel */}
          <Card className="flex flex-col h-full bg-gray-50/50">
            <div className="p-4 border-b border-gray-200 bg-white rounded-t-xl">
              <h3 className="font-semibold text-gray-900">Unassigned Deliveries</h3>
              <p className="text-sm text-gray-500">{items.unassigned.length} items available</p>
            </div>
            <div ref={setUnassignedRef} className="flex-1 p-4 overflow-y-auto space-y-3" id="unassigned-container">
              <SortableContext
                items={items.unassigned.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.unassigned.map(item => (
                  <SortableItem key={item.id} item={item} />
                ))}
                {items.unassigned.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-sm text-gray-400">
                    No unassigned deliveries
                  </div>
                )}
              </SortableContext>
            </div>
          </Card>

          {/* Assigned Panel */}
          <Card className="flex flex-col h-full bg-white ring-1 ring-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Truck Allocation</h3>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className={cn("font-medium", isOverweight ? "text-red-600" : "text-gray-700")}>
                    {currentWeight.toLocaleString()} / {truckCapacity.toLocaleString()} lbs
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
            <div ref={setAssignedRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/30" id="assigned-container">
              <SortableContext
                items={items.assigned.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.assigned.map((item, index) => (
                  <div key={item.id} className="relative">
                    <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-sm border-2 border-white">
                      {index + 1}
                    </div>
                    <div className="ml-4">
                      <SortableItem item={item} />
                    </div>
                  </div>
                ))}
                {items.assigned.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-sm text-gray-400 bg-white">
                    Drag deliveries here
                  </div>
                )}
              </SortableContext>
            </div>
          </Card>

          <DragOverlay>
            {activeItem ? (
              <div className="opacity-80 rotate-2 scale-105">
                <div className="flex items-center gap-3 rounded-lg border border-primary-500 bg-white p-3 shadow-lg">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{activeItem.customerName}</p>
                  </div>
                  <div className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                    {activeItem.weight.toLocaleString()} lbs
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
