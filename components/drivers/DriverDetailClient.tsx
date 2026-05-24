'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { PageHeader } from '@/components/ui/PageHeader';
import { User as UserIcon, Phone, FileText, Edit2, Archive, Save, X, Calendar } from 'lucide-react';
import type { Driver } from '@prisma/client';
import { useRouter } from 'next/navigation';

export function DriverDetailClient({ driver }: { driver: Driver }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: driver.name,
    phone: driver.phone || '',
    licenseNumber: driver.licenseNumber || '',
    status: driver.status,
    notes: driver.notes || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error?.message || 'Failed to update driver');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating driver');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this driver?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true })
      });
      
      if (res.ok) {
        router.push('/drivers');
        router.refresh();
      } else {
        alert('Failed to archive driver');
      }
    } catch (e) {
      console.error(e);
      alert('Error archiving driver');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title={driver.name} 
        description="Driver profile and status."
      >
        <div className="flex items-center gap-3">
          {!isEditing && <StatusPill status={driver.status} />}
          {!isEditing ? (
            <>
              <button 
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                <Edit2 className="h-4 w-4 text-gray-500" /> Edit
              </button>
              <button 
                onClick={handleArchive}
                className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-50"
              >
                <Archive className="h-4 w-4" /> Archive
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Save
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 space-y-6 md:col-span-1">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <UserIcon className="h-7 w-7" />
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <input 
                    type="text" name="name" value={formData.name} onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="ON_TRIP">ON TRIP</option>
                    <option value="OFF_DUTY">OFF DUTY</option>
                  </select>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-gray-900">{driver.name}</h2>
                </>
              )}
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Phone
              </span>
              {isEditing ? (
                <input 
                  type="text" name="phone" value={formData.phone} onChange={handleChange}
                  className="block w-32 rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 text-right"
                />
              ) : (
                <span className="text-sm font-semibold text-gray-900">{driver.phone || 'N/A'}</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> License
              </span>
              {isEditing ? (
                <input 
                  type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange}
                  className="block w-32 rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 text-right"
                />
              ) : (
                <span className="text-sm font-medium text-gray-900">{driver.licenseNumber || 'N/A'}</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Added
              </span>
              <span className="text-sm font-medium text-gray-900">{new Date(driver.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100">
            <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Notes</span>
            {isEditing ? (
              <textarea 
                name="notes" value={formData.notes} onChange={handleChange} rows={3}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            ) : (
              <p className="text-sm text-gray-700">{driver.notes || 'No notes added.'}</p>
            )}
          </div>
        </Card>

        <Card className="p-6 md:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Load Plans</h3>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <UserIcon className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">Load plan history will appear here once connected to the database.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
