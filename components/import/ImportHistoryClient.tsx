'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  FileText,
  RefreshCw,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface ImportJobRecord {
  id: string;
  filename: string | null;
  sourceType: string;
  status: string;
  uploadedBy: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  summary: ImportJobSummary | null;
  _count: {
    rows: number;
    deliveries: number;
  };
}

// ─── Status Config ───────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
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

const defaultStatus = { label: 'Unknown', color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', icon: Clock };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getTimeSince(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ImportHistoryClient() {
  const [jobs, setJobs] = useState<ImportJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/import/history');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch (${res.status})`);
      }
      const data = await res.json();
      setJobs(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load import history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading import history…</span>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
        <XCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 mb-3">{error}</p>
        <button onClick={fetchJobs} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          Try again
        </button>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <FileText className="h-10 w-10 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No imports yet</h3>
        <p className="text-sm text-gray-500 mb-4">
          Upload a CSV file from the Import page to get started.
        </p>
        <a
          href="/import"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Go to Import
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  // ── Table ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-end mb-4">
        <button
          onClick={fetchJobs}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Rows</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Inserted</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Skipped</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map((job) => {
                const config = statusConfig[job.status] || defaultStatus;
                const Icon = config.icon;
                const summary = job.summary as ImportJobSummary | null;

                return (
                  <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Filename */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-900 truncate max-w-[200px]">
                          {job.filename || 'Untitled'}
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.bgColor} ${config.color}`}>
                        <Icon className={`h-3 w-3 ${job.status === 'PARSING' || job.status === 'MAPPING' || job.status === 'VALIDATING' || job.status === 'IMPORTING' || job.status === 'UPLOADING' ? 'animate-spin' : ''}`} />
                        {config.label}
                      </span>
                    </td>

                    {/* Row Count */}
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-700">
                      {summary?.totalRows ?? (job._count.rows || '—')}
                    </td>

                    {/* Inserted */}
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {summary?.inserted != null ? (
                        <span className="text-green-600 font-medium">{summary.inserted}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Updated */}
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {summary?.updated != null ? (
                        <span className="text-blue-600 font-medium">{summary.updated}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Skipped */}
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {summary?.skipped != null ? (
                        <span className="text-amber-600">{summary.skipped}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-600">
                      {formatDuration(summary?.totalDurationMs)}
                    </td>

                    {/* Upload Time */}
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="text-gray-700">{formatDate(job.createdAt)}</p>
                        <p className="text-xs text-gray-400">{getTimeSince(job.createdAt)}</p>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-3 text-xs text-gray-400 text-right">
        {jobs.length} import{jobs.length !== 1 ? 's' : ''} total
      </div>
    </div>
  );
}
