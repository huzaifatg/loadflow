'use client';

import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusPill } from '@/components/ui/StatusPill';
import type { Driver } from '@prisma/client';
import { MoreHorizontal, Archive } from 'lucide-react';
import { useRouter } from 'next/navigation';

function DriverActions({ driver }: { driver: Driver }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleArchive() {
    if (loading) return;
    if (!confirm('Are you sure you want to archive this driver?')) return;
    
    setLoading(true);
    setIsOpen(false);
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
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
            <button
              onClick={handleArchive}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
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

export function DriversTable({ data }: { data: Driver[] }) {
  const columns: Column<Driver>[] = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'licenseNumber', label: 'License #' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusPill status={row.status} />
    },
    {
      key: 'actions',
      label: '',
      render: (row) => <DriverActions driver={row} />
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage="No active drivers found."
    />
  );
}
