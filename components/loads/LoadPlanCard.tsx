import React from 'react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Truck, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface LoadPlanCardProps {
  id: string;
  date: string;
  status: string;
  truckName: string;
  driverName?: string;
  totalDeliveries: number;
}

export function LoadPlanCard({ id, date, status, truckName, driverName, totalDeliveries }: LoadPlanCardProps) {
  return (
    <Link href={`/loads/${id}`}>
      <Card className="hover:shadow-md transition-all group cursor-pointer p-5 flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center text-sm text-gray-500 mb-1">
              <Calendar className="h-4 w-4 mr-1.5" />
              {date}
            </div>
            <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
              Plan {id.split('-')[0]}...
            </h3>
          </div>
          <StatusPill status={status} />
        </div>
        
        <div className="mt-4 space-y-3">
          <div className="flex items-center text-sm">
            <Truck className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-gray-700">{truckName}</span>
            {driverName && <span className="text-gray-400 ml-1">({driverName})</span>}
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-500">{totalDeliveries} Deliveries</span>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
        </div>
      </Card>
    </Link>
  );
}
