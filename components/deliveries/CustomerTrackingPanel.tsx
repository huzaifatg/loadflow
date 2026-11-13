'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  ShieldOff,
  RefreshCw,
  Plus,
  Calendar,
  MapPin,
  Clock,
  Globe,
  Lock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { AuthenticatedTrackingView } from '@/lib/services/tracking';

const MILESTONE_TYPE_OPTIONS = [
  { value: 'MANUAL_UPDATE', label: 'General Shipment Update' },
  { value: 'IN_TRANSIT', label: 'In Transit Update' },
  { value: 'ARRIVED_AT_DESTINATION', label: 'Arrived at Destination Facility' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'DELAY_NOTICE', label: 'Delay / Schedule Notice' },
];

export function CustomerTrackingPanel({
  deliveryId,
  customerName,
  scheduledDate,
  initialTracking,
}: {
  deliveryId: string;
  customerName: string;
  deliveryStatus: string;
  scheduledDate: string | null;
  initialTracking: AuthenticatedTrackingView;
}) {
  const router = useRouter();
  const [tracking, setTracking] = useState<AuthenticatedTrackingView>(initialTracking);
  const [origin, setOrigin] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Confirm dialogs
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  // Settings form state (ETA & Expiration)
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [etaInput, setEtaInput] = useState(
    initialTracking.link?.estimatedDeliveryAt
      ? new Date(initialTracking.link.estimatedDeliveryAt).toISOString().slice(0, 16)
      : scheduledDate
        ? new Date(scheduledDate).toISOString().slice(0, 16)
        : ''
  );
  const [expiresInput, setExpiresInput] = useState(
    initialTracking.link?.expiresAt
      ? new Date(initialTracking.link.expiresAt).toISOString().slice(0, 16)
      : ''
  );

  // Manual milestone form state
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneType, setMilestoneType] = useState('MANUAL_UPDATE');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneLocation, setMilestoneLocation] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneVisible, setMilestoneVisible] = useState(true);

  useEffect(() => {
    setTracking(initialTracking);
  }, [initialTracking]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const link = tracking.link;
  const fullTrackingUrl =
    link?.publicPath && origin
      ? `${origin}${link.publicPath}`
      : link?.publicPath || '';

  const handleCopyLink = async () => {
    if (!fullTrackingUrl) return;
    try {
      await navigator.clipboard.writeText(fullTrackingUrl);
      setCopied(true);
      toast.success('Customer tracking link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Unable to copy link automatically');
    }
  };

  const handleGenerateOrUpdate = async (opts: {
    rotate?: boolean;
    includeSettings?: boolean;
  }) => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        action: opts.rotate ? 'rotate' : 'generate',
        rotate: Boolean(opts.rotate),
      };

      if (opts.includeSettings) {
        payload.estimatedDeliveryAt = etaInput ? new Date(etaInput).toISOString() : null;
        payload.expiresAt = expiresInput ? new Date(expiresInput).toISOString() : null;
      }

      const res = await fetch(`/api/deliveries/${deliveryId}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to update customer tracking link');
        return;
      }

      setTracking((prev) => ({
        ...prev,
        link: json.data,
      }));
      setShowRotateConfirm(false);
      setShowSettingsForm(false);
      toast.success(
        opts.rotate
          ? 'Tracking link rotated — previous link is now revoked'
          : json.created
            ? 'Customer tracking link generated'
            : 'Customer tracking settings saved'
      );
      router.refresh();
    } catch {
      toast.error('Network error while updating tracking link');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/tracking`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to revoke tracking link');
        return;
      }

      setTracking((prev) => ({
        ...prev,
        link: json.data,
      }));
      setShowRevokeConfirm(false);
      toast.success('Customer tracking link revoked');
      router.refresh();
    } catch {
      toast.error('Network error while revoking tracking link');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (milestoneTitle.trim().length < 3) {
      toast.error('Please enter a milestone title (at least 3 characters)');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_milestone',
          eventType: milestoneType,
          title: milestoneTitle.trim(),
          locationLabel: milestoneLocation.trim() || null,
          description: milestoneDescription.trim() || null,
          customerVisible: milestoneVisible,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to add tracking milestone');
        return;
      }

      setTracking((prev) => ({
        ...prev,
        events: [json.data, ...prev.events],
      }));
      setMilestoneTitle('');
      setMilestoneLocation('');
      setMilestoneDescription('');
      setShowMilestoneForm(false);
      toast.success('Tracking milestone recorded');
      router.refresh();
    } catch {
      toast.error('Network error while adding tracking milestone');
    } finally {
      setBusy(false);
    }
  };

  const statusTone =
    link?.status === 'ACTIVE'
      ? 'success'
      : link?.status === 'EXPIRED'
        ? 'warning'
        : 'danger';

  return (
    <Card>
      <ConfirmDialog
        isOpen={showRevokeConfirm}
        onClose={() => setShowRevokeConfirm(false)}
        onConfirm={handleRevoke}
        loading={busy}
        tone="danger"
        title="Revoke Customer Tracking Link?"
        description={`Revoking disables public shipment tracking for ${customerName} immediately.`}
        consequences={[
          'Anyone opening the existing link will see a generic unavailable message.',
          'You can generate a replacement tracking link at any time.',
        ]}
        confirmLabel="Revoke Link"
      />

      <ConfirmDialog
        isOpen={showRotateConfirm}
        onClose={() => setShowRotateConfirm(false)}
        onConfirm={() => handleGenerateOrUpdate({ rotate: true, includeSettings: false })}
        loading={busy}
        tone="warning"
        title="Generate Replacement Tracking Link?"
        description="This immediately revokes the current tracking token and issues a brand-new URL."
        consequences={[
          'Previously shared tracking URLs will stop working immediately.',
          'Existing shipment milestones and ETA are preserved.',
        ]}
        confirmLabel="Rotate Link"
      />

      <CardHeader
        title="Customer Shipment Tracking"
        description="Share a secure, read-only live tracking portal with your customer — no account required"
        icon={<Share2 className="h-4 w-4" />}
        bordered
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {link ? (
              <Badge tone={statusTone} size="sm" dot>
                {link.status === 'ACTIVE'
                  ? 'Tracking Active'
                  : link.status === 'EXPIRED'
                    ? 'Link Expired'
                    : 'Link Revoked'}
              </Badge>
            ) : (
              <Badge tone="neutral" size="sm">
                Not Enabled
              </Badge>
            )}
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => setShowMilestoneForm((v) => !v)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Milestone Update
            </Button>
          </div>
        }
      />

      <CardContent className="space-y-5">
        {/* Link Status & Actions */}
        {!link || link.status !== 'ACTIVE' ? (
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                {!link
                  ? 'Public tracking is not enabled for this delivery'
                  : link.status === 'REVOKED'
                    ? `Previous tracking link (${link.tokenPreview}) was revoked`
                    : `Previous tracking link (${link.tokenPreview}) expired`}
              </p>
              <p className="text-xs text-gray-600">
                {!link
                  ? 'Generate a cryptographically secure link so your customer can view shipment status, ETA, and milestones without logging in.'
                  : 'Customers cannot access the previous URL. Generate a new tracking link to restore external visibility.'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={busy}
                onClick={() =>
                  handleGenerateOrUpdate({
                    rotate: Boolean(link),
                    includeSettings: true,
                  })
                }
              >
                <Share2 className="h-3.5 w-3.5" />
                {!link ? 'Generate Tracking Link' : 'Generate New Link'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-4">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                    Shareable Customer Tracking URL
                  </span>
                  <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-600 border border-gray-200">
                    Token {link.tokenPreview}
                  </span>
                </div>
                {fullTrackingUrl ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      aria-label="Public tracking URL"
                      value={fullTrackingUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-xs text-gray-800 focus:border-primary-500 focus:outline-hidden"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">
                    Active tracking link is live. Click Rotate Link to issue a new copyable URL.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {fullTrackingUrl && (
                  <>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleCopyLink}
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy Link
                        </>
                      )}
                    </Button>
                    <a
                      href={link.publicPath || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Portal
                    </a>
                  </>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSettingsForm((v) => !v)}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  ETA & Expiry
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRotateConfirm(true)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Rotate
                </Button>
                <Button
                  type="button"
                  variant="danger-subtle"
                  size="sm"
                  onClick={() => setShowRevokeConfirm(true)}
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  Revoke
                </Button>
              </div>
            </div>

            {/* Metadata strip */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-emerald-200/60 pt-2.5 text-xs text-gray-600">
              <span>
                <strong className="font-medium text-gray-800">Customer ETA:</strong>{' '}
                {link.estimatedDeliveryAt
                  ? format(new Date(link.estimatedDeliveryAt), 'MMM d, yyyy • h:mm a')
                  : scheduledDate
                    ? `${format(new Date(scheduledDate), 'MMM d, yyyy')} (Scheduled date)`
                    : 'Not set'}
              </span>
              <span>
                <strong className="font-medium text-gray-800">Link Expires:</strong>{' '}
                {link.expiresAt
                  ? format(new Date(link.expiresAt), 'MMM d, yyyy • h:mm a')
                  : 'Never (until revoked)'}
              </span>
              {link.lastAccessedAt && (
                <span>
                  <strong className="font-medium text-gray-800">Last Viewed:</strong>{' '}
                  {format(new Date(link.lastAccessedAt), 'MMM d, yyyy • h:mm a')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ETA & Expiration Configuration Form */}
        {showSettingsForm && link?.status === 'ACTIVE' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                Configure Customer ETA & Link Expiration
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Customer-Facing Estimated Delivery (ETA)"
                type="datetime-local"
                value={etaInput}
                onChange={(e) => setEtaInput(e.target.value)}
                hint="Shown on the public tracking portal when set."
              />
              <Input
                label="Tracking Link Expiration (Optional)"
                type="datetime-local"
                value={expiresInput}
                onChange={(e) => setExpiresInput(e.target.value)}
                hint="Leave blank for no automatic expiration."
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowSettingsForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="xs"
                loading={busy}
                onClick={() =>
                  handleGenerateOrUpdate({ rotate: false, includeSettings: true })
                }
              >
                Save Tracking Settings
              </Button>
            </div>
          </div>
        )}

        {/* Add Manual Customer-Visible Milestone Form */}
        {showMilestoneForm && (
          <form
            onSubmit={handleAddMilestone}
            className="rounded-xl border border-primary-200 bg-primary-50/20 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                Post Shipment Milestone Update
              </h4>
              <span className="text-[11px] text-gray-500">
                Adds an informational milestone without bypassing load plan lifecycle
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select
                label="Milestone Type"
                value={milestoneType}
                onChange={(e) => setMilestoneType(e.target.value)}
                options={MILESTONE_TYPE_OPTIONS}
              />
              <Input
                label="Milestone Title"
                placeholder="e.g. Arrived at regional hub"
                value={milestoneTitle}
                maxLength={120}
                required
                onChange={(e) => setMilestoneTitle(e.target.value)}
              />
              <Input
                label="Location (Optional)"
                placeholder="e.g. Dallas Distribution Center"
                value={milestoneLocation}
                maxLength={120}
                onChange={(e) => setMilestoneLocation(e.target.value)}
              />
            </div>

            <Textarea
              label="Customer-Safe Description (Optional)"
              rows={2}
              maxLength={500}
              placeholder="Provide a concise status note for the recipient (do not include internal pricing or driver phone numbers)..."
              value={milestoneDescription}
              onChange={(e) => setMilestoneDescription(e.target.value)}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={milestoneVisible}
                  onChange={(e) => setMilestoneVisible(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Visible on public customer tracking page
              </label>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowMilestoneForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="xs" loading={busy}>
                  Publish Milestone
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Recorded Shipment Milestones List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Recorded Shipment Milestones ({tracking.events.length})
            </h4>
          </div>

          {tracking.events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-500">
              Automatic lifecycle milestones (Order Received, Assigned, In Transit, Delivered) are shown on the public portal automatically. Use &ldquo;Add Milestone Update&rdquo; to post custom checkpoints.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {tracking.events.map((evt) => (
                <li
                  key={evt.id}
                  className="flex flex-col justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900">
                        {evt.title}
                      </span>
                      {evt.locationLabel && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          {evt.locationLabel}
                        </span>
                      )}
                      {evt.customerVisible ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          <Globe className="h-2.5 w-2.5" />
                          Customer Visible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          <Lock className="h-2.5 w-2.5" />
                          Internal Only
                        </span>
                      )}
                    </div>
                    {evt.description && (
                      <p className="text-xs text-gray-600">{evt.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-[11px] text-gray-400 tabular-nums">
                    <Clock className="h-3 w-3" />
                    {format(new Date(evt.occurredAt), 'MMM d, yyyy • h:mm a')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
