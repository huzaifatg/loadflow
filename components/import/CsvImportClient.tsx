'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, XCircle, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { ImportReviewClient } from './ImportReviewClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StageTiming {
  stage: string;
  durationMs: number;
}

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

interface UploadResult {
  success: boolean;
  importJobId: string;
  completedStage: string;
  failedStage: string | null;
  failureReason: string | null;
  totalDurationMs: number;
  wasRolledBack: boolean;
  timings: StageTiming[];
  preview?: PreviewData;
}

type UploadState = 'idle' | 'uploading' | 'review' | 'error';

// ─── Component ───────────────────────────────────────────────────────────────

export function CsvImportClient() {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
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
      if (data.success && data.preview) {
        setUploadState('review');
      } else {
        setUploadState('error');
        setErrorMessage(data.failureReason || 'Upload failed.');
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

  // ── Review State ─────────────────────────────────────────────────────────
  if (uploadState === 'review' && result?.preview) {
    return (
      <ImportReviewClient
        importJobId={result.importJobId}
        filename={selectedFile?.name || 'upload.csv'}
        preview={result.preview}
        totalDurationMs={result.totalDurationMs}
        onCancel={handleReset}
        onBack={handleReset}
      />
    );
  }

  // ── Upload UI ────────────────────────────────────────────────────────────
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
                Analyzing…
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Preview Import
              </>
            )}
          </button>
        </div>
      </div>

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
