'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusPill } from '@/components/ui/StatusPill';
import Link from 'next/link';
import type { Delivery } from '@prisma/client';
import { MoreHorizontal, Archive, CheckCircle, Truck, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

function DeliveryActions({ delivery }: { delivery: Delivery }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAction(action: string, data: any) {
    if (loading) return;
    setLoading(true);
    setIsOpen(false);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Action failed');
      }
    } catch (e) {
      console.error(e);
      alert('Error performing action');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1">
            {delivery.status === 'ASSIGNED' && (
              <button
                onClick={() => handleAction('status', { status: 'IN_TRANSIT' })}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Truck className="h-4 w-4 mr-2" /> Mark In Transit
              </button>
            )}
            {delivery.status === 'IN_TRANSIT' && (
              <button
                onClick={() => handleAction('status', { status: 'DELIVERED' })}
                className="w-full text-left px-4 py-2 text-sm text-emerald-700 hover:bg-gray-100 flex items-center"
              >
                <CheckCircle className="h-4 w-4 mr-2" /> Mark Delivered
              </button>
            )}
            {(delivery.status === 'PENDING' || delivery.status === 'ASSIGNED') && (
              <button
                onClick={() => handleAction('status', { status: 'CANCELLED' })}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
              >
                <XCircle className="h-4 w-4 mr-2" /> Cancel Delivery
              </button>
            )}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to archive this delivery?')) {
                  handleAction('archive', { isArchived: true });
                }
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 flex items-center border-t mt-1"
            >
              <Archive className="h-4 w-4 mr-2" /> Archive
            </button>
          </div>
        </div>
      )}
      {/* Invisible overlay to close dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-0" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

export function DeliveriesTable({ data }: { data: Delivery[] }) {
  const columns: Column<Delivery>[] = [
    {
      key: 'id',
      label: 'Order ID',
      render: (row) => (
        <Link href={`/deliveries/${row.id}`} className="font-medium text-primary-600 hover:text-primary-700">
          {row.id.split('-')[0]}...
        </Link>
      ),
    },
    { key: 'customerName', label: 'Customer' },
    { key: 'pickupAddress', label: 'Pickup' },
    { key: 'deliveryAddress', label: 'Destination' },
    { 
      key: 'weight', 
      label: 'Weight (kg)',
      render: (row) => row.weight.toLocaleString()
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusPill status={row.status} />
    },
    {
      key: 'actions',
      label: '',
      render: (row) => <DeliveryActions delivery={row} />
    }
  ];

  return (
    <DataTable 
      columns={columns} 
      data={data} 
      emptyMessage="No active deliveries found."
    />
  );
}
