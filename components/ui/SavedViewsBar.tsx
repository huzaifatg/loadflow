'use client';

import React, { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Bookmark, Plus, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DEFAULT_PRESET_VIEWS,
  sanitizeViewQuery,
  type SavedViewWorkspace,
  type CustomSavedView,
} from '@/lib/services/saved-views';

export interface SavedViewsBarProps {
  workspace: SavedViewWorkspace;
  initialCustomViews?: CustomSavedView[];
  className?: string;
}

export function SavedViewsBar({
  workspace,
  initialCustomViews = [],
  className,
}: SavedViewsBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [customViews, setCustomViews] =
    useState<CustomSavedView[]>(initialCustomViews);
  const [savingOpen, setSavingOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const presets = DEFAULT_PRESET_VIEWS[workspace] ?? [];
  const currentNormalized = sanitizeViewQuery(searchParams.toString());

  const applyQuery = (query: string) => {
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const handleSaveView = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = viewName.trim();
    if (!trimmed || submitting) return;
    if (!currentNormalized) {
      toast.error('Select a filter or enter a search query before saving a view.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace,
          name: trimmed,
          query: currentNormalized,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Could not save view');
        return;
      }
      setCustomViews((prev) => {
        const filtered = prev.filter((v) => v.id !== data.id && v.name !== data.name);
        return [...filtered, data];
      });
      setViewName('');
      setSavingOpen(false);
      toast.success(`Saved view "${data.name}"`);
    } catch {
      toast.error('Failed to save view');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteView = async (view: CustomSavedView) => {
    try {
      const res = await fetch(`/api/saved-views/${view.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCustomViews((prev) => prev.filter((v) => v.id !== view.id));
        toast.success(`Deleted view "${view.name}"`);
      } else {
        toast.error('Could not delete saved view');
      }
    } catch {
      toast.error('Error deleting saved view');
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200/80 bg-gray-50/70 px-3.5 py-2 text-xs',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 pr-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          <Bookmark className="h-3 w-3 text-gray-400" />
          Views
        </span>

        <button
          type="button"
          onClick={() => applyQuery('')}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
            !currentNormalized
              ? 'bg-gray-900 text-white shadow-2xs'
              : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 hover:text-gray-900'
          )}
        >
          All Records
        </button>

        {presets.map((preset) => {
          const normalizedPreset = sanitizeViewQuery(preset.query);
          const isActive = currentNormalized === normalizedPreset;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyQuery(preset.query)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
                isActive
                  ? 'bg-primary-600 text-white shadow-2xs'
                  : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:border-primary-300 hover:text-primary-700'
              )}
            >
              {preset.name}
            </button>
          );
        })}

        {customViews.length > 0 && (
          <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden />
        )}

        {customViews.map((view) => {
          const normalizedView = sanitizeViewQuery(view.query);
          const isActive = currentNormalized === normalizedView;
          return (
            <div
              key={view.id}
              className={cn(
                'inline-flex items-center rounded-md ring-1 ring-inset transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-800 ring-primary-300'
                  : 'bg-white text-gray-700 ring-gray-200 hover:ring-gray-300'
              )}
            >
              <button
                type="button"
                onClick={() => applyQuery(view.query)}
                className="px-2 py-1 text-xs font-medium cursor-pointer"
                title={`Custom view: ?${view.query}`}
              >
                {view.name}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteView(view)}
                className="pr-1.5 pl-0.5 text-gray-400 hover:text-rose-600 cursor-pointer"
                aria-label={`Delete saved view ${view.name}`}
                title="Delete saved view"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Save current filter combination */}
      {currentNormalized && (
        <div className="flex items-center gap-1.5">
          {savingOpen ? (
            <form onSubmit={handleSaveView} className="flex items-center gap-1.5">
              <input
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Name this view..."
                maxLength={40}
                autoFocus
                className="h-7 w-40 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:border-primary-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting || !viewName.trim()}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-primary-600 px-2.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-3 w-3" />
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavingOpen(false);
                  setViewName('');
                }}
                className="h-7 rounded-md px-2 text-xs font-medium text-gray-500 hover:bg-gray-200/70 cursor-pointer"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setSavingOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-primary-200 bg-primary-50/70 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              Save Current View
            </button>
          )}
        </div>
      )}
    </div>
  );
}

