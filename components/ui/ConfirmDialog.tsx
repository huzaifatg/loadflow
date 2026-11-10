'use client';

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  consequences?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'warning' | 'success';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  consequences,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
}: ConfirmDialogProps) {
  const iconConfig = {
    danger: {
      bg: 'bg-rose-50 border-rose-200 text-rose-600',
      Icon: AlertTriangle,
      buttonVariant: 'danger' as const,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-600',
      Icon: AlertTriangle,
      buttonVariant: 'primary' as const,
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
      Icon: CheckCircle2,
      buttonVariant: 'success' as const,
    },
    primary: {
      bg: 'bg-primary-50 border-primary-200 text-primary-600',
      Icon: Info,
      buttonVariant: 'primary' as const,
    },
  }[tone];

  const Icon = iconConfig.Icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      size="sm"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={iconConfig.buttonVariant}
            size="md"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
            iconConfig.bg
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            {description}
          </p>
          {consequences && consequences.length > 0 && (
            <ul className="mt-3 space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs text-gray-600">
              {consequences.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

