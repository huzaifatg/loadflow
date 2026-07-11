'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, XCircle, Loader2, AlertTriangle, Clock, ArrowRight } from 'lucide-react';

interface ImportStats {
  totalRows: number;
  inserted: number;
  updated: number;
  failed: number;
  skipped: number;
}

interface StageTiming {
  stage: string;
  durationMs: number;
}

interface ImportResult {
  success: boolean;
  importJobId: string;
  completedStage: string;
  failedStage: string | null;
  failureReason: string | null;
  totalDurationMs: number;
  wasRolledBack: boolean;
  stats: ImportStats;
  timings: StageTiming[];
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function CsvImportClient() {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setErrorMessage(null);
      setUploadState('idle');
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploadState('uploading');
    setResult(null);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/import/csv', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadState('error');
        setErrorMessage(data.error || `Server error (${response.status})`);
        return;
      }

      setResult(data);
      setUploadState(data.success ? 'success' : 'error');
      if (!data.success) {
        setErrorMessage(data.failureReason || 'Import failed.');
      }
    } catch (err) {
      setUploadState('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }, [selectedFile]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setResult(null);
    setErrorMessage(null);
    setUploadState('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Upload Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* File Selection */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Upload CSV File</h2>
              <p className="text-sm text-gray-500">Import deliveries from a CSV file</p>
            </div>
          </div>

          {/* File Input Area */}
          <div
            className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-200"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-file-input"
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">Click to select a CSV file</p>
                <p className="text-xs text-gray-400 mt-1">Maximum file size: 10MB</p>
              </div>
            )}
          </div>

          {/* Required Format Info */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-600 mb-1">Required CSV columns:</p>
            <div className="flex flex-wrap gap-1.5">
              {['customer_name', 'pickup_address', 'delivery_address'].map(col => (
                <span key={col} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-700 font-mono">
                  {col}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Optional: weight, scheduled_date, notes, external_id
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            disabled={uploadState === 'uploading'}
          >
            Reset
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploadState === 'uploading'}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            id="import-submit-btn"
          >
            {uploadState === 'uploading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Import Deliveries
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result Card */}
      {uploadState === 'success' && result && (
        <div className="mt-6 bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900">Import Successful</h3>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Rows" value={result.stats.totalRows} color="gray" />
              <StatCard label="Inserted" value={result.stats.inserted} color="green" />
              <StatCard label="Updated" value={result.stats.updated} color="blue" />
              <StatCard label="Skipped" value={result.stats.skipped} color="amber" />
            </div>

            {/* Pipeline Timing */}
            {result.timings && result.timings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-xs font-medium text-gray-500">Pipeline Timing</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.timings.map((t, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-gray-50 rounded border border-gray-100 text-gray-600">
                      {t.stage}: {t.durationMs.toFixed(1)}ms
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Total: {result.totalDurationMs.toFixed(1)}ms
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Card */}
      {uploadState === 'error' && (
        <div className="mt-6 bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-3">
              {result?.wasRolledBack ? (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" />
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {result?.wasRolledBack ? 'Import Rolled Back' : 'Import Failed'}
              </h3>
            </div>

            <p className="text-sm text-gray-600 mb-3">{errorMessage}</p>

            {result && (
              <div className="text-xs text-gray-500 space-y-1">
                {result.failedStage && (
                  <p>Failed at stage: <span className="font-mono font-medium">{result.failedStage}</span></p>
                )}
                {result.completedStage && (
                  <p>Last completed: <span className="font-mono font-medium">{result.completedStage}</span></p>
                )}
              </div>
            )}

            <button
              onClick={handleReset}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-900 border-gray-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <div className={`rounded-lg border p-3 text-center ${colorClasses[color] || colorClasses.gray}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
    </div>
  );
}
