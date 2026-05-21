'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { User, Building2, Bell, Shield, LogOut, Save, Check } from 'lucide-react';
import type { Company } from '@prisma/client';

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </Card>
  );
}

function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          checked ? 'bg-primary-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

interface SettingsFormProps {
  email: string | undefined;
  company: Company | null;
}

export function SettingsForm({ email, company }: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile
  const [fullName, setFullName] = useState('Admin User');
  const [displayName, setDisplayName] = useState('Admin');
  const [phone, setPhone] = useState('');

  // Company
  const [companyName, setCompanyName] = useState(company?.name || '');
  const [timezone, setTimezone] = useState('America/Chicago');

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [dispatchAlerts, setDispatchAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    
    try {
      const res = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <SettingsSection
        icon={User}
        title="Profile"
        description="Your personal information and display settings."
      >
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-xl font-bold text-white shadow-lg shadow-primary-500/20">
              {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Profile Photo</p>
              <p className="text-xs text-gray-500">Avatar is generated from your initials.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
            />
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane"
            />
          </div>

          <Input
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
              <span>{email || 'Managed by authentication provider'}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed here for security reasons.</p>
          </div>
        </div>
      </SettingsSection>

      {/* Company */}
      <SettingsSection
        icon={Building2}
        title="Company"
        description="Your organization details and regional settings."
      >
        <div className="space-y-5">
          <Input
            label="Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Logistics"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Phoenix">Arizona Time (AZ)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred Units</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUnits('imperial')}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                  units === 'imperial'
                    ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Imperial (lbs, mi)
              </button>
              <button
                type="button"
                onClick={() => setUnits('metric')}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                  units === 'metric'
                    ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Metric (kg, km)
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection
        icon={Bell}
        title="Notifications"
        description="Configure how and when you receive alerts."
      >
        <div className="divide-y divide-gray-100">
          <ToggleSwitch
            label="Email Notifications"
            description="Receive email updates about your deliveries and load plans."
            checked={emailNotifications}
            onChange={setEmailNotifications}
          />
          <ToggleSwitch
            label="Dispatch Alerts"
            description="Get notified when a load plan is dispatched or completed."
            checked={dispatchAlerts}
            onChange={setDispatchAlerts}
          />
          <ToggleSwitch
            label="Weekly Summary Report"
            description="Receive a weekly digest of your logistics operations."
            checked={weeklyReport}
            onChange={setWeeklyReport}
          />
        </div>
      </SettingsSection>

      {/* Security & Account */}
      <SettingsSection
        icon={Shield}
        title="Security & Account"
        description="Manage your session and account access."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Sign Out</p>
              <p className="text-xs text-gray-500 mt-0.5">
                End your current session on this device.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="!text-red-600 hover:!bg-red-50 hover:!border-red-200"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Save bar */}
      <div className="sticky bottom-4 z-20">
        <div className="flex items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white/90 backdrop-blur-md p-4 shadow-lg">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 animate-in fade-in slide-in-from-left-2 duration-200">
              <Check className="h-4 w-4" />
              Settings saved
            </span>
          )}
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4 mr-1.5" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
