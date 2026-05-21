'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
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

interface DeliveryItem {
  id: string;
  customerName: string;
  deliveryAddress: string;
  weight: number;
}

interface AllocationPanelProps {
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

// Simple non-sortable list for unassigned items to just click 'Add' or drag
// Actually, to make cross-container dnd simple, we will keep it simple and just do
// two SortableContexts, but for the sake of robust operation within a single file:
export function AllocationPanel({ initialUnassigned, initialAssigned, truckCapacity }: AllocationPanelProps) {
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [assigned, setAssigned] = useState(initialAssigned);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const currentWeight = assigned.reduce((sum, item) => sum + item.weight, 0);
  const percentFull = Math.min((currentWeight / truckCapacity) * 100, 100);
  const isOverweight = currentWeight > truckCapacity;

  function findContainer(id: string) {
    if (unassigned.find((item) => item.id === id)) return 'unassigned';
    if (assigned.find((item) => item.id === id)) return 'assigned';
    return null;
  }

  function handleDragStart(event: any) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event: any) {
    const { active, over } = event;
    const overId = over?.id;

    if (!overId || active.id === overId) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(overId) || (overId === 'assigned-container' ? 'assigned' : 'unassigned');

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    // Moving between containers
    if (activeContainer === 'unassigned') {
      const activeItem = unassigned.find(i => i.id === active.id)!;
      setUnassigned(prev => prev.filter(i => i.id !== active.id));
      setAssigned(prev => {
        const overIndex = prev.findIndex(i => i.id === overId);
        const newIndex = overIndex >= 0 ? overIndex : prev.length;
        const newArr = [...prev];
        newArr.splice(newIndex, 0, activeItem);
        return newArr;
      });
    } else {
      const activeItem = assigned.find(i => i.id === active.id)!;
      setAssigned(prev => prev.filter(i => i.id !== active.id));
      setUnassigned(prev => {
        const overIndex = prev.findIndex(i => i.id === overId);
        const newIndex = overIndex >= 0 ? overIndex : prev.length;
        const newArr = [...prev];
        newArr.splice(newIndex, 0, activeItem);
        return newArr;
      });
    }
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id) || (over.id === 'assigned-container' ? 'assigned' : 'unassigned');

    if (activeContainer && activeContainer === overContainer) {
      if (activeContainer === 'unassigned') {
        const oldIndex = unassigned.findIndex(i => i.id === active.id);
        const newIndex = unassigned.findIndex(i => i.id === over.id);
        if (oldIndex !== newIndex) {
          setUnassigned(arrayMove(unassigned, oldIndex, newIndex));
        }
      } else {
        const oldIndex = assigned.findIndex(i => i.id === active.id);
        const newIndex = assigned.findIndex(i => i.id === over.id);
        if (oldIndex !== newIndex) {
          setAssigned(arrayMove(assigned, oldIndex, newIndex));
        }
      }
    }
  }

  const activeItem = activeId ? [...unassigned, ...assigned].find(i => i.id === activeId) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Unassigned Panel */}
        <Card className="flex flex-col h-full bg-gray-50/50">
          <div className="p-4 border-b border-gray-200 bg-white rounded-t-xl">
            <h3 className="font-semibold text-gray-900">Unassigned Deliveries</h3>
            <p className="text-sm text-gray-500">{unassigned.length} items available</p>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3" id="unassigned-container">
            <SortableContext
              items={unassigned.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {unassigned.map(item => (
                <SortableItem key={item.id} item={item} />
              ))}
              {unassigned.length === 0 && (
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
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/30" id="assigned-container">
            <SortableContext
              items={assigned.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {assigned.map((item, index) => (
                <div key={item.id} className="relative">
                  <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-sm border-2 border-white">
                    {index + 1}
                  </div>
                  <div className="ml-4">
                    <SortableItem item={item} />
                  </div>
                </div>
              ))}
              {assigned.length === 0 && (
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
  );
}
