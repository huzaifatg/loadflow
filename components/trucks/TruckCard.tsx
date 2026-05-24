'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Truck, Archive } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface TruckCardProps {
  id: string;
  name: string;
  plateNumber: string;
  type: string;
  weightCapacity: number;
  status: string;
}

export function TruckCard({ id, name, plateNumber, type, weightCapacity, status }: TruckCardProps) {
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);

  async function handleArchive(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to archive this truck?')) return;
    
    setArchiving(true);
    try {
      const res = await fetch(`/api/trucks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to archive truck');
        setArchiving(false);
      }
    } catch (err) {
      console.error(err);
      alert('Error archiving truck');
      setArchiving(false);
    }
  }

  if (archiving) {
    return (
      <Card className="p-5 flex flex-col h-full animate-pulse bg-gray-50 border-gray-100">
        <div className="h-full flex items-center justify-center text-sm text-gray-400">Archiving...</div>
      </Card>
    );
  }

  return (
    <Link href={`/trucks/${id}`}>
      <Card className="hover:shadow-md transition-shadow group cursor-pointer p-5 flex flex-col h-full animate-in fade-in zoom-in-95 duration-300 relative">
        <button 
          onClick={handleArchive}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Archive Truck"
        >
          <Archive className="h-4 w-4" />
        </button>
        
        <div className="flex justify-between items-start mb-4 pr-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{name}</h3>
              <p className="text-xs font-mono text-gray-500 mt-0.5">{plateNumber} &bull; {type}</p>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <StatusPill status={status} />
        </div>
        
        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
          <span className="text-gray-500">Capacity</span>
          <span className="font-medium text-gray-900">{weightCapacity.toLocaleString()} kg</span>
        </div>
      </Card>
    </Link>
  );
}
