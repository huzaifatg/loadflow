'use client';

import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { DEFAULT_QUANTITY_UNITS, UNIT_TYPE_LABELS, UNIT_TYPE_DESCRIPTIONS } from '@/lib/constants';
import { computeItemWeight } from '@/lib/delivery-items';

export interface DeliveryItemFormData {
  _key: string; // Stable client-side key for React rendering
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
    _key: crypto.randomUUID(),
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
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-primary-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 rounded-md ring-offset-white"
        >
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          Delivery Items
          {items.length > 0 && (
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
              {items.length}
            </span>
          )}
          {items.length > 0 && (
            <span className="text-xs font-medium text-gray-500 ml-1">
              • {totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
            </span>
          )}
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5 text-gray-400" />
            Add
          </button>
        )}
      </div>

      {/* Items list */}
      {expanded && (
        <div className="space-y-3">
          {items.map((item, index) => (
            <ItemRow
              key={item._key}
              item={item}
              index={index}
              onUpdate={(field, value) => updateItem(index, field, value)}
              onRemove={() => removeItem(index)}
              readOnly={readOnly}
            />
          ))}
          
          {items.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center bg-gray-50/30 hover:bg-gray-50/80 transition-colors">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 mb-3 ring-1 ring-inset ring-gray-200">
                <Plus className="h-5 w-5 text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900">No items added</p>
              <p className="text-sm text-gray-500 mt-1 mb-5">Add items to automatically calculate the total delivery weight.</p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
                >
                  <Plus className="h-4 w-4 text-gray-400" />
                  Add First Item
                </button>
              )}
            </div>
          )}

          {items.length > 0 && !readOnly && (
            <button
              type="button"
              onClick={addItem}
              className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 p-3 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 hover:bg-gray-50 transition-all focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-1 mt-2"
            >
              <Plus className="h-4 w-4" />
              Add Another Item
            </button>
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
    <div className="rounded-lg bg-white ring-1 ring-gray-200 shadow-sm transition-all hover:ring-gray-300 relative group overflow-hidden">
      {/* Decorative left border for visual anchoring */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-100 group-hover:bg-primary-500 transition-colors" />
      
      <div className="p-4 sm:p-5 pl-5 sm:pl-6 space-y-4">
        {/* Header: Number, Product Name, SKU, and Delete */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-8 flex items-start gap-3">
              <span className="mt-1 flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold ring-1 ring-inset ring-gray-200">
                {index + 1}
              </span>
              <div className="flex-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Product Name</label>
                <input
                  type="text"
                  value={item.productName}
                  onChange={(e) => onUpdate('productName', e.target.value)}
                  placeholder="e.g. Premium Topside"
                  disabled={readOnly}
                  className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200 transition-shadow"
                />
              </div>
            </div>
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">SKU / Code</label>
              <input
                type="text"
                value={item.sku}
                onChange={(e) => onUpdate('sku', e.target.value)}
                placeholder="Optional"
                disabled={readOnly}
                className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200 transition-shadow"
              />
            </div>
          </div>
          
          {!readOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="mt-6 sm:mt-1 flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 w-full" />

        {/* Row 2: Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          {/* Quantity & Unit */}
          <div className="sm:col-span-4 flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Quantity</label>
              <input
                type="number"
                value={item.quantity || ''}
                onChange={(e) => onUpdate('quantity', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                disabled={readOnly}
                className="block w-full rounded-md border-0 py-1.5 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Unit</label>
              <select
                value={item.quantityUnit}
                onChange={(e) => onUpdate('quantityUnit', e.target.value)}
                disabled={readOnly}
                className="block w-full rounded-md border-0 py-1.5 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200"
              >
                {DEFAULT_QUANTITY_UNITS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Weight Config */}
          <div className="sm:col-span-8 flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                Weight Type
              </label>
              <select
                value={item.unitType}
                onChange={(e) => onUpdate('unitType', e.target.value)}
                disabled={readOnly}
                className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200"
                title={UNIT_TYPE_DESCRIPTIONS[item.unitType]}
              >
                {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1">
              {showUnitWeight && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Weight per Unit (kg)</label>
                  <input
                    type="number"
                    value={item.unitWeight ?? ''}
                    onChange={(e) => onUpdate('unitWeight', e.target.value ? parseFloat(e.target.value) : null)}
                    min="0"
                    step="0.01"
                    placeholder="e.g. 20"
                    disabled={readOnly}
                    className="block w-full rounded-md border-0 py-1.5 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200"
                  />
                </div>
              )}
              {showTotalWeightInput && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-primary-600 mb-1">Actual Total (kg)</label>
                  <input
                    type="number"
                    value={item.totalWeight ?? ''}
                    onChange={(e) => onUpdate('totalWeight', e.target.value ? parseFloat(e.target.value) : null)}
                    min="0"
                    step="0.01"
                    placeholder="e.g. 183.4"
                    disabled={readOnly}
                    className="block w-full rounded-md border-0 py-1.5 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-primary-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 disabled:bg-gray-50 disabled:text-gray-500 disabled:ring-gray-200 bg-primary-50/30"
                  />
                </div>
              )}
            </div>

            {/* Computed Result Box */}
            <div className="flex-1 bg-gray-50 rounded-md ring-1 ring-inset ring-gray-200 p-2 sm:p-2.5 flex flex-col justify-center">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Line Weight</span>
              <span className={`text-sm font-bold ${computedWeight > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                {computedWeight > 0
                  ? `${computedWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
                  : '—'
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
