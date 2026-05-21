'use client';

import React, { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: keyof typeof sizeStyles;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  /* ── Escape key ──────────────────────────────────── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full rounded-2xl bg-white shadow-2xl animate-slide-up',
          sizeStyles[size]
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
