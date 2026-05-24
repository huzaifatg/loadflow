"use client";

import { DndContext } from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

export function AllocationPanel({ loadPlanId, initialUnassigned, initialAssigned, truckCapacity }: any) {
  return (
    <DndContext>
      <SortableContext
        items={[]}
        strategy={verticalListSortingStrategy}
      >
        <div style={{ padding: 20, border: '2px dashed green' }}>
          SortableContext Works
        </div>
      </SortableContext>
    </DndContext>
  );
}
