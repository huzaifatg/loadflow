'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  FileText,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Info,
  RotateCcw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImportRowRecord {
  id: string;
  rowNumber: number;
  rawData: Record<string, unknown> | null;
  mappedData: Record<string, unknown> | null;
  status: string;
  errors: unknown[] | null;
  warnings: unknown[] | null;
  createdAt: string;
}

interface ImportJobSummary {
  totalRows?: number;
  inserted?: number;
  updated?: number;
  failed?: number;
  skipped?: number;
  failedStage?: string;
  reason?: string;
  totalDurationMs?: number;
}

interface ImportJobDetail {
  id: string;
  filename: string | null;
  sourceType: string;
  status: string;
  uploadedBy: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  summary: ImportJobSummary | null;
  rows: ImportRowRecord[];
  _count: {
    deliveries: number;
  };
}

// ─── Status Config ───────────────────────────────────────────────────────────

const jobStatusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  COMPLETED: { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: CheckCircle2 },
  FAILED: { label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: XCircle },
  ROLLED_BACK: { label: 'Rolled Back', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: RotateCcw },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200', icon: XCircle },
  PARSING: { label: 'Parsing', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: Loader2 },
  MAPPING: { label: 'Mapping', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: Loader2 },
  VALIDATING: { label: 'Validating', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: Loader2 },
  IMPORTING: { label: 'Importing', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: Loader2 },
  QUEUED: { label: 'Queued', color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', icon: Clock },
  UPLOADING: { label: 'Uploading', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: Loader2 },
  READY_FOR_REVIEW: { label: 'Ready for Review', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', icon: AlertTriangle },
};

const rowStatusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  IMPORTED: { label: 'Imported', color: 'text-green-700', dotColor: 'bg-green-500' },
  VALID: { label: 'Valid', color: 'text-green-600', dotColor: 'bg-green-400' },
  PENDING: { label: 'Pending', color: 'text-gray-600', dotColor: 'bg-gray-400' },
  WARNING: { label: 'Warning', color: 'text-amber-700', dotColor: 'bg-amber-500' },
  ERROR: { label: 'Error', color: 'text-red-700', dotColor: 'bg-red-500' },
  DUPLICATE: { label: 'Duplicate', color: 'text-orange-700', dotColor: 'bg-orange-500' },
  SKIPPED: { label: 'Skipped', color: 'text-gray-500', dotColor: 'bg-gray-400' },
};

const defaultJobStatus = { label: 'Unknown', color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', icon: Clock };
const defaultRowStatus = { label: 'Unknown', color: 'text-gray-600', dotColor: 'bg-gray-400' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function summarizeData(data: Record<string, unknown> | null): string[] {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${String(v)}`);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ImportDetailClient({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<ImportJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/import/history/${jobId}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `Failed to fetch (${res.status})`);
        }
        const d = await res.json();
        setJob(d.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load import details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading import details…</span>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !job) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
        <XCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 mb-3">{error || 'Import job not found.'}</p>
        <Link href="/import/history" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          ← Back to Import History
        </Link>
      </div>
    );
  }

  const config = jobStatusConfig[job.status] || defaultJobStatus;
  const StatusIcon = config.icon;
  const summary = job.summary as ImportJobSummary | null;

  // Count diagnostics from rows
  const totalErrors = job.rows.reduce((sum, r) => sum + (Array.isArray(r.errors) ? r.errors.length : 0), 0);
  const totalWarnings = job.rows.reduce((sum, r) => sum + (Array.isArray(r.warnings) ? r.warnings.length : 0), 0);

  return (
    <div className="space-y-6">
      {/* ── Back Link ─────────────────────────────────────────────────────── */}
      <Link
        href="/import/history"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Import History
      </Link>

      {/* ── Metadata Card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {job.filename || 'Untitled Import'}
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {job.id}
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.bgColor} ${config.color}`}>
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <MetaField label="Source" value={job.sourceType} />
            <MetaField label="Uploaded" value={formatDate(job.createdAt)} />
            <MetaField label="Started" value={formatDate(job.startedAt)} />
            <MetaField label="Completed" value={formatDate(job.completedAt)} />
            <MetaField label="Duration" value={formatDuration(summary?.totalDurationMs)} />
            <MetaField label="Deliveries Created" value={String(job._count.deliveries)} />
          </div>

          {/* Failure reason */}
          {summary?.reason && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-medium text-red-600 mb-1">Failure Reason</p>
              <p className="text-sm text-red-800">{summary.reason}</p>
              {summary.failedStage && (
                <p className="text-xs text-red-500 mt-1">
                  Failed at stage: <span className="font-mono">{summary.failedStage}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryCard label="Total Rows" value={summary?.totalRows ?? job.rows.length} color="gray" />
        <SummaryCard label="Inserted" value={summary?.inserted ?? 0} color="green" />
        <SummaryCard label="Updated" value={summary?.updated ?? 0} color="blue" />
        <SummaryCard label="Skipped" value={summary?.skipped ?? 0} color="amber" />
        <SummaryCard label="Failed" value={summary?.failed ?? 0} color="red" />
        <SummaryCard label="Warnings" value={totalWarnings} color="orange" />
        <SummaryCard label="Errors" value={totalErrors} color="rose" />
      </div>

      {/* ── Imported Rows Table ────────────────────────────────────────────── */}
      {job.rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Imported Rows ({job.rows.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="w-10 px-4 py-2.5"></th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Errors</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {job.rows.map((row) => {
                  const rs = rowStatusConfig[row.status] || defaultRowStatus;
                  const isExpanded = expandedRows.has(row.id);
                  const rawEntries = summarizeData(row.rawData as Record<string, unknown> | null);
                  const mappedEntries = summarizeData(row.mappedData as Record<string, unknown> | null);
                  const errCount = Array.isArray(row.errors) ? row.errors.length : 0;
                  const warnCount = Array.isArray(row.warnings) ? row.warnings.length : 0;

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => toggleRow(row.id)}
                      >
                        <td className="px-4 py-3">
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                          }
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium text-gray-700">
                          #{row.rowNumber}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${rs.dotColor}`} />
                            <span className={`text-xs font-medium ${rs.color}`}>{rs.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[300px] truncate">
                          {rawEntries.length > 0
                            ? rawEntries.slice(0, 3).join(' · ')
                            : <span className="text-gray-400">No data</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {errCount > 0
                            ? <span className="text-red-600 font-medium">{errCount}</span>
                            : <span className="text-gray-300">0</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {warnCount > 0
                            ? <span className="text-amber-600 font-medium">{warnCount}</span>
                            : <span className="text-gray-300">0</span>
                          }
                        </td>
                      </tr>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-gray-50/50 px-4 py-4">
                            <div className="pl-10 space-y-4">
                              {/* Raw Data */}
                              {rawEntries.length > 0 && (
                                <DetailSection title="Raw Data">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                    {rawEntries.map((entry, i) => (
                                      <span key={i} className="text-xs text-gray-600 font-mono bg-white px-2 py-1 rounded border border-gray-100">
                                        {entry}
                                      </span>
                                    ))}
                                  </div>
                                </DetailSection>
                              )}

                              {/* Mapped Data */}
                              {mappedEntries.length > 0 && (
                                <DetailSection title="Mapped Data">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                    {mappedEntries.map((entry, i) => (
                                      <span key={i} className="text-xs text-gray-600 font-mono bg-white px-2 py-1 rounded border border-gray-100">
                                        {entry}
                                      </span>
                                    ))}
                                  </div>
                                </DetailSection>
                              )}

                              {/* Errors */}
                              {errCount > 0 && (
                                <DetailSection title="Errors">
                                  <div className="space-y-1">
                                    {(row.errors as any[]).map((err, i) => (
                                      <DiagnosticEntry key={i} item={err} severity="error" />
                                    ))}
                                  </div>
                                </DetailSection>
                              )}

                              {/* Warnings */}
                              {warnCount > 0 && (
                                <DetailSection title="Warnings">
                                  <div className="space-y-1">
                                    {(row.warnings as any[]).map((warn, i) => (
                                      <DiagnosticEntry key={i} item={warn} severity="warning" />
                                    ))}
                                  </div>
                                </DetailSection>
                              )}

                              {rawEntries.length === 0 && mappedEntries.length === 0 && errCount === 0 && warnCount === 0 && (
                                <p className="text-xs text-gray-400 italic">No additional detail available for this row.</p>
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

      {/* Empty rows state */}
      {job.rows.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Info className="h-6 w-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No row data recorded for this import.</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-gray-700 font-medium">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-900 border-gray-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
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

function DiagnosticEntry({ item, severity }: { item: any; severity: 'error' | 'warning' }) {
  const msg = typeof item === 'string' ? item : (item?.message || item?.code || JSON.stringify(item));
  const code = typeof item === 'object' ? item?.code : null;
  const row = typeof item === 'object' ? item?.row : null;
  const column = typeof item === 'object' ? item?.column : null;

  const borderColor = severity === 'error' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50';

  return (
    <div className={`text-xs px-3 py-2 rounded border ${borderColor} flex items-start gap-2`}>
      {severity === 'error'
        ? <XCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
        : <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 flex-shrink-0" />
      }
      <div className="min-w-0">
        <p className="text-gray-700">{msg}</p>
        {(code || row != null || column) && (
          <p className="text-gray-400 mt-0.5">
            {code && <span className="font-mono mr-2">{code}</span>}
            {row != null && <span className="mr-2">Row {row}</span>}
            {column && <span>Col: {column}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
