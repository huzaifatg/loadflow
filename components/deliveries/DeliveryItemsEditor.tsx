'use client';

import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { DEFAULT_QUANTITY_UNITS, UNIT_TYPE_LABELS, UNIT_TYPE_DESCRIPTIONS } from '@/lib/constants';
import { computeItemWeight } from '@/lib/delivery-items';

export interface DeliveryItemFormData {
  productName: string;
  sku: string;
  quantity: number;
  quantityUnit: string;
  unitType: string;
  unitWeight: number | null;
  totalWeight: number | null;
  notes: string;
}

interface DeliveryItemsEditorProps {
  items: DeliveryItemFormData[];
  onChange: (items: DeliveryItemFormData[]) => void;
  readOnly?: boolean;
}

function createEmptyItem(): DeliveryItemFormData {
  return {
    productName: '',
    sku: '',
    quantity: 1,
    quantityUnit: 'cartons',
    unitType: 'STANDARD_WEIGHT',
    unitWeight: null,
    totalWeight: null,
    notes: '',
  };
}

export function DeliveryItemsEditor({ items, onChange, readOnly = false }: DeliveryItemsEditorProps) {
  const [expanded, setExpanded] = useState(items.length > 0);

  function addItem() {
    onChange([...items, createEmptyItem()]);
    setExpanded(true);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof DeliveryItemFormData, value: unknown) {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      return { ...item, [field]: value };
    });
    onChange(updated);
  }

  // Compute total weight for all items
  const totalWeight = items.reduce((sum, item) => {
    return sum + computeItemWeight({
      unitType: item.unitType,
      quantity: item.quantity,
      unitWeight: item.unitWeight,
      totalWeight: item.totalWeight,
    });
  }, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Delivery Items
          {items.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-600/20">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          )}
          {items.length > 0 && (
            <span className="text-xs font-medium text-gray-500">
              • {totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg total
            </span>
          )}
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors ring-1 ring-inset ring-primary-600/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
        )}
      </div>

      {/* Items list */}
      {expanded && (
        <div className="space-y-3">
          {items.map((item, index) => (
            <ItemRow
              key={index}
              item={item}
              index={index}
              onUpdate={(field, value) => updateItem(index, field, value)}
              onRemove={() => removeItem(index)}
              readOnly={readOnly}
            />
          ))}
          {items.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-6 text-center">
              <p className="text-sm text-gray-400">No items added yet. Weight will be entered manually.</p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  + Add first item
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Item Row Component ──────────────────────────────────────────────────────

function ItemRow({
  item,
  index,
  onUpdate,
  onRemove,
  readOnly,
}: {
  item: DeliveryItemFormData;
  index: number;
  onUpdate: (field: keyof DeliveryItemFormData, value: unknown) => void;
  onRemove: () => void;
  readOnly: boolean;
}) {
  const computedWeight = computeItemWeight({
    unitType: item.unitType,
    quantity: item.quantity,
    unitWeight: item.unitWeight,
    totalWeight: item.totalWeight,
  });

  const showUnitWeight = item.unitType === 'STANDARD_WEIGHT' || item.unitType === 'PIECE_BASED';
  const showTotalWeightInput = item.unitType === 'VARIABLE_WEIGHT';

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3 relative group">
      {/* Item number + delete */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-800 text-white text-[10px] font-bold">
          {index + 1}
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Row 1: Product name + SKU */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Product Name</label>
          <input
            type="text"
            value={item.productName}
            onChange={(e) => onUpdate('productName', e.target.value)}
            placeholder="e.g. NZ Topside"
            disabled={readOnly}
            className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">SKU / Code</label>
          <input
            type="text"
            value={item.sku}
            onChange={(e) => onUpdate('sku', e.target.value)}
            placeholder="Optional"
            disabled={readOnly}
            className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Row 2: Quantity + Unit + Unit Type */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
          <input
            type="number"
            value={item.quantity || ''}
            onChange={(e) => onUpdate('quantity', parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            disabled={readOnly}
            className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
          <select
            value={item.quantityUnit}
            onChange={(e) => onUpdate('quantityUnit', e.target.value)}
            disabled={readOnly}
            className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {DEFAULT_QUANTITY_UNITS.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Weight Type</label>
          <select
            value={item.unitType}
            onChange={(e) => onUpdate('unitType', e.target.value)}
            disabled={readOnly}
            className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
            title={UNIT_TYPE_DESCRIPTIONS[item.unitType]}
          >
            {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 3: Weight fields */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {showUnitWeight && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Weight per Unit (kg)</label>
            <input
              type="number"
              value={item.unitWeight ?? ''}
              onChange={(e) => onUpdate('unitWeight', e.target.value ? parseFloat(e.target.value) : null)}
              min="0"
              step="0.01"
              placeholder="e.g. 20"
              disabled={readOnly}
              className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        )}
        {showTotalWeightInput && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Actual Total Weight (kg)</label>
            <input
              type="number"
              value={item.totalWeight ?? ''}
              onChange={(e) => onUpdate('totalWeight', e.target.value ? parseFloat(e.target.value) : null)}
              min="0"
              step="0.01"
              placeholder="e.g. 183.4"
              disabled={readOnly}
              className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Line Weight</label>
          <div className="flex items-center h-[34px] px-3 rounded-md bg-gray-100 text-sm font-semibold text-gray-700">
            {computedWeight > 0
              ? `${computedWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
              : '—'
            }
          </div>
        </div>
      </div>
    </div>
  );
}
