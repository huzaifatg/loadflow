import React from 'react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Truck } from 'lucide-react';
import Link from 'next/link';

interface TruckCardProps {
  id: string;
  name: string;
  plateNumber: string;
  weightCapacity: number;
  status: string;
}

export function TruckCard({ id, name, plateNumber, weightCapacity, status }: TruckCardProps) {
  return (
    <Link href={`/trucks/${id}`}>
      <Card className="hover:shadow-md transition-shadow group cursor-pointer p-5 flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{name}</h3>
              <p className="text-xs font-mono text-gray-500 mt-0.5">{plateNumber}</p>
            </div>
          </div>
          <StatusPill status={status} />
        </div>
        
        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
          <span className="text-gray-500">Capacity</span>
          <span className="font-medium text-gray-900">{weightCapacity.toLocaleString()} lbs</span>
        </div>
      </Card>
    </Link>
  );
}
