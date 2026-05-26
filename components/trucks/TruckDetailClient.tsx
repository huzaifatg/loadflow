'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { PageHeader } from '@/components/ui/PageHeader';
import { Truck as TruckIcon, Gauge, Calendar, Edit2, Archive, Save, X, ClipboardList } from 'lucide-react';
import type { Truck } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';

interface LoadPlanSummary {
  id: string;
  date: string | Date;
  status: string;
  _count?: { items: number };
}

export function TruckDetailClient({ truck, loadPlans = [] }: { truck: Truck; loadPlans?: LoadPlanSummary[] }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: truck.name,
    plateNumber: truck.plateNumber,
    weightCapacity: truck.weightCapacity,
    status: truck.status,
    notes: truck.notes || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        weightCapacity: Number(formData.weightCapacity)
      };
      
      const res = await fetch(`/api/trucks/${truck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        toast.success('Truck updated successfully');
        setIsEditing(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Failed to update truck');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error updating truck');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this truck?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/trucks/${truck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true })
      });
      
      if (res.ok) {
        toast.success('Truck archived successfully');
        router.push('/trucks');
        router.refresh();
      } else {
        toast.error('Failed to archive truck');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error archiving truck');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title={truck.name} 
        description={`Plate: ${truck.plateNumber}`}
      >
        <div className="flex items-center gap-3">
          {!isEditing && <StatusPill status={truck.status} />}
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
            <div className="h-14 w-14 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center">
              <TruckIcon className="h-7 w-7" />
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <input 
                    type="text" name="name" value={formData.name} onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                  <input 
                    type="text" name="plateNumber" value={formData.plateNumber} onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 font-mono text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="IN_USE">IN USE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-gray-900">{truck.name}</h2>
                  <p className="font-mono text-sm text-gray-500">{truck.plateNumber}</p>
                </>
              )}
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" /> Capacity (kg)
              </span>
              {isEditing ? (
                <input 
                  type="number" name="weightCapacity" value={formData.weightCapacity} onChange={handleChange}
                  className="block w-24 rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 text-right"
                />
              ) : (
                <span className="text-sm font-semibold text-gray-900">{truck.weightCapacity.toLocaleString()} kg</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Added
              </span>
              <span className="text-sm font-medium text-gray-900">{new Date(truck.createdAt).toLocaleDateString()}</span>
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
              <p className="text-sm text-gray-700">{truck.notes || 'No notes added.'}</p>
            )}
          </div>
        </Card>

        <Card className="p-6 md:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Load Plans</h3>
          {loadPlans.length > 0 ? (
            <div className="space-y-3">
              {loadPlans.map((plan) => (
                <Link key={plan.id} href={`/loads/${plan.id}`} className="block">
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 bg-gray-100 rounded-lg flex items-center justify-center">
                        <ClipboardList className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{new Date(plan.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        <p className="text-xs text-gray-500">{plan._count?.items || 0} deliveries</p>
                      </div>
                    </div>
                    <StatusPill status={plan.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <TruckIcon className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">No load plans assigned to this truck yet.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
