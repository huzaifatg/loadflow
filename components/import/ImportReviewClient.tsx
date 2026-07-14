'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  MinusCircle,
  RotateCcw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreviewRow {
  rowNumber: number;
  action: string;
  validationStatus: string;
  mappingStatus: string;
  changedFieldCount: number;
  changedFields: string[];
  hasDuplicateKey: boolean;
  skipReason: string | null;
  beforeValues: Record<string, unknown>;
  afterValues: Record<string, unknown>;
}

interface PreviewData {
  totalRows: number;
  rowsToCreate: number;
  rowsToUpdate: number;
  rowsSkipped: number;
  rowsNoChange: number;
  duplicateKeyCount: number;
  warningCount: number;
  errorCount: number;
  rows: PreviewRow[];
}

interface ImportReviewProps {
  importJobId: string;
  filename: string;
  preview: PreviewData;
  totalDurationMs: number;
  onCancel: () => void;
  onBack: () => void;
}

// ─── Action Config ───────────────────────────────────────────────────────────

const actionConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  create: { label: 'Create', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: Plus },
  update: { label: 'Update', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: RefreshCw },
  skip: { label: 'Skip', color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', icon: MinusCircle },
  no_change: { label: 'No Change', color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200', icon: MinusCircle },
};

const defaultAction = { label: 'Unknown', color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200', icon: MinusCircle };

// ─── Component ───────────────────────────────────────────────────────────────

export function ImportReviewClient({
  importJobId,
  filename,
  preview,
  totalDurationMs,
  onCancel,
  onBack,
}: ImportReviewProps) {
  const router = useRouter();
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (rowNum: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum);
      else next.add(rowNum);
      return next;
    });
  };

  const handleCommit = async () => {
    setCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importJobId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCommitError(data.failureReason || data.error || 'Commit failed.');
        setCommitting(false);
        return;
      }
      // Navigate to import details
      router.push(`/import/history/${importJobId}`);
    } catch {
      setCommitError('Network error. Please try again.');
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Review Import</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filename} · {preview.totalRows} row{preview.totalRows !== 1 ? 's' : ''} parsed in {(totalDurationMs / 1000).toFixed(1)}s
          </p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Upload
        </button>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <SummaryCard label="Total Rows" value={preview.totalRows} color="gray" />
        <SummaryCard label="Create" value={preview.rowsToCreate} color="green" />
        <SummaryCard label="Update" value={preview.rowsToUpdate} color="blue" />
        <SummaryCard label="Skip" value={preview.rowsSkipped} color="amber" />
        <SummaryCard label="No Change" value={preview.rowsNoChange} color="slate" />
        <SummaryCard label="Duplicates" value={preview.duplicateKeyCount} color="orange" />
        <SummaryCard label="Warnings" value={preview.warningCount} color="yellow" />
        <SummaryCard label="Errors" value={preview.errorCount} color="red" />
      </div>

      {/* ── Preview Table ──────────────────────────────────────────────────── */}
      {preview.rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Row Preview ({preview.rows.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="w-10 px-4 py-2.5"></th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Validation</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Mapping</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preview.rows.map((row) => {
                  const ac = actionConfig[row.action] || defaultAction;
                  const ActionIcon = ac.icon;
                  const isExpanded = expandedRows.has(row.rowNumber);
                  const customerName = (row.afterValues?.customerName || row.afterValues?.customer_name || '—') as string;

                  return (
                    <React.Fragment key={row.rowNumber}>
                      <tr
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => toggleRow(row.rowNumber)}
                      >
                        <td className="px-4 py-3">
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                          }
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium text-gray-700">#{row.rowNumber}</td>
                        <td className="px-4 py-3 text-gray-700 truncate max-w-[200px]">{customerName}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border ${ac.bgColor} ${ac.color}`}>
                            <ActionIcon className="h-3 w-3" />
                            {ac.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusDot status={row.validationStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusDot status={row.mappingStatus} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                          {row.changedFieldCount > 0 ? row.changedFieldCount : '—'}
                        </td>
                      </tr>

                      {/* Expanded Row Detail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-gray-50/50 px-4 py-4">
                            <div className="pl-10 space-y-3">
                              {/* Mapped Values */}
                              {Object.keys(row.afterValues || {}).length > 0 && (
                                <DetailSection title="Mapped Values">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                    {Object.entries(row.afterValues).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                                      <span key={k} className="text-xs text-gray-600 font-mono bg-white px-2 py-1 rounded border border-gray-100">
                                        {k}: {String(v)}
                                      </span>
                                    ))}
                                  </div>
                                </DetailSection>
                              )}

                              {/* Changed Fields */}
                              {row.changedFields.length > 0 && (
                                <DetailSection title="Changed Fields">
                                  <div className="flex flex-wrap gap-1">
                                    {row.changedFields.map((f) => (
                                      <span key={f} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 font-mono">
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                </DetailSection>
                              )}

                              {/* Skip Reason */}
                              {row.skipReason && (
                                <DetailSection title="Skip Reason">
                                  <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                    {row.skipReason}
                                  </p>
                                </DetailSection>
                              )}

                              {/* Duplicate Warning */}
                              {row.hasDuplicateKey && (
                                <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                                  <AlertTriangle className="h-3 w-3" />
                                  Duplicate key detected
                                </div>
                              )}

                              {Object.keys(row.afterValues || {}).length === 0 && !row.skipReason && !row.hasDuplicateKey && (
                                <p className="text-xs text-gray-400 italic">No additional detail available.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Commit Error ───────────────────────────────────────────────────── */}
      {commitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Commit Failed</p>
            <p className="text-sm text-red-600 mt-0.5">{commitError}</p>
          </div>
        </div>
      )}

      {/* ── Action Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={committing}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel Import
          </button>
          <button
            onClick={onBack}
            disabled={committing}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="h-3.5 w-3.5 inline mr-1" />
            Return to Upload
          </button>
        </div>
        <button
          onClick={handleCommit}
          disabled={committing || preview.totalRows === 0}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {committing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Committing…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Confirm Import ({preview.rowsToCreate + preview.rowsToUpdate} rows)
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-900 border-gray-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${colorMap[color] || colorMap.gray}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    valid: { color: 'bg-green-500', label: 'Valid' },
    mapped: { color: 'bg-green-500', label: 'Mapped' },
    warning: { color: 'bg-amber-500', label: 'Warning' },
    error: { color: 'bg-red-500', label: 'Error' },
    skipped: { color: 'bg-gray-400', label: 'Skipped' },
    unmapped: { color: 'bg-gray-400', label: 'Unmapped' },
    partial: { color: 'bg-amber-400', label: 'Partial' },
  };
  const cfg = map[status] || { color: 'bg-gray-400', label: status };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${cfg.color}`} />
      <span className="text-xs text-gray-600">{cfg.label}</span>
    </span>
  );
}
