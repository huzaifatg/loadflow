'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { PageHeader } from '@/components/ui/PageHeader';
import { MapPin, Package, User, Weight, Edit2, Archive, Save, X } from 'lucide-react';
import type { Delivery } from '@prisma/client';
import { useRouter } from 'next/navigation';

export function DeliveryDetailClient({ delivery }: { delivery: Delivery }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerName: delivery.customerName,
    weight: delivery.weight,
    pickupAddress: delivery.pickupAddress,
    deliveryAddress: delivery.deliveryAddress,
    notes: delivery.notes || '',
    scheduledDate: delivery.scheduledDate ? new Date(delivery.scheduledDate).toISOString().slice(0, 16) : ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        weight: Number(formData.weight),
        scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate).toISOString() : null
      };
      
      const res = await fetch(`/api/deliveries/${delivery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error?.message || 'Failed to update delivery');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this delivery?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true })
      });
      
      if (res.ok) {
        router.push('/deliveries');
        router.refresh();
      } else {
        alert('Failed to archive delivery');
      }
    } catch (e) {
      console.error(e);
      alert('Error archiving delivery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`Delivery #${delivery.id.split('-')[0]}`} 
        description="Delivery details and tracking information."
      >
        <div className="flex items-center gap-3">
          <StatusPill status={delivery.status} />
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-5">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            Customer Information
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-gray-100 gap-2">
              <span className="text-gray-500 w-1/3">Customer</span>
              {isEditing ? (
                <input 
                  type="text" name="customerName" value={formData.customerName} onChange={handleChange}
                  className="block w-full sm:w-2/3 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              ) : (
                <span className="font-medium text-gray-900 text-right">{delivery.customerName}</span>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-gray-100 gap-2">
              <span className="text-gray-500 w-1/3 flex items-center gap-1.5">
                <Weight className="h-3.5 w-3.5" /> Weight (kg)
              </span>
              {isEditing ? (
                <input 
                  type="number" name="weight" value={formData.weight} onChange={handleChange}
                  className="block w-full sm:w-2/3 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              ) : (
                <span className="font-medium text-gray-900 text-right">{delivery.weight.toLocaleString()} kg</span>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-gray-100 gap-2">
              <span className="text-gray-500 w-1/3">Scheduled</span>
              {isEditing ? (
                <input 
                  type="datetime-local" name="scheduledDate" value={formData.scheduledDate} onChange={handleChange}
                  className="block w-full sm:w-2/3 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              ) : (
                <span className="font-medium text-gray-900 text-right">{delivery.scheduledDate ? new Date(delivery.scheduledDate).toLocaleString() : 'Not scheduled'}</span>
              )}
            </div>
            
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500">Created</span>
              <span className="font-medium text-gray-900">{new Date(delivery.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            Route Details
          </h3>
          <div className="space-y-5">
            <div className="relative pl-6">
              <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
              <div className="absolute left-[5px] top-5 h-full w-0.5 bg-gray-200" />
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Pickup</span>
              {isEditing ? (
                <input 
                  type="text" name="pickupAddress" value={formData.pickupAddress} onChange={handleChange}
                  className="block w-full mt-2 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              ) : (
                <span className="block mt-1 text-sm font-medium text-gray-900">{delivery.pickupAddress}</span>
              )}
            </div>
            <div className="relative pl-6">
              <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-primary-500 ring-4 ring-primary-50" />
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Dropoff</span>
              {isEditing ? (
                <input 
                  type="text" name="deliveryAddress" value={formData.deliveryAddress} onChange={handleChange}
                  className="block w-full mt-2 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              ) : (
                <span className="block mt-1 text-sm font-medium text-gray-900">{delivery.deliveryAddress}</span>
              )}
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
              <p className="text-sm text-gray-700">{delivery.notes || 'No notes added.'}</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
