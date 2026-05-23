import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TruckForm } from '@/components/trucks/TruckForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewTruckPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="mb-4">
        <Link href="/trucks" className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Fleet
        </Link>
      </div>
      
      <PageHeader 
        title="Add New Truck" 
        description="Register a new vehicle into your fleet management system."
      />
      
      <TruckForm />
    </div>
  );
}
