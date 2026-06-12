'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { 
  BookOpen, 
  Package, 
  Truck, 
  Users, 
  ClipboardList, 
  CheckCircle2, 
  ArrowRight,
  Scale,
  Shield
} from 'lucide-react';

function GuideSection({ 
  icon: Icon, 
  title, 
  children,
  step
}: { 
  icon: React.ElementType, 
  title: string, 
  children: React.ReactNode,
  step?: number
}) {
  return (
    <Card className="overflow-hidden mb-6 hover:shadow-md transition-shadow">
      <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex items-center gap-4">
        {step && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
            {step}
          </div>
        )}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm border border-gray-100 text-primary-600">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6 text-gray-600 space-y-4">
        {children}
      </div>
    </Card>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl pb-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            How LoadFlow Works
          </h1>
        </div>
        <p className="text-lg text-gray-500 mt-2 max-w-2xl">
          Welcome to LoadFlow. This guide will help you understand the core concepts and daily workflow to manage your logistics operations efficiently.
        </p>
      </div>

      {/* What is LoadFlow? */}
      <Card className="mb-10 bg-gradient-to-br from-primary-600 to-primary-800 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-48 h-48 bg-white opacity-5 rounded-full blur-2xl" />
        <div className="absolute left-1/4 bottom-0 -mb-8 w-32 h-32 bg-white opacity-5 rounded-full blur-xl" />
        <div className="relative p-8 sm:p-10">
          <h2 className="text-2xl font-bold mb-4">What is LoadFlow?</h2>
          <p className="text-primary-100 text-lg leading-relaxed max-w-3xl">
            LoadFlow is a comprehensive logistics execution platform. It acts as the central brain of your operations, connecting four core components: <strong>Deliveries</strong> (what needs to be shipped), <strong>Trucks</strong> (the assets used to ship them), <strong>Drivers</strong> (the personnel executing the shipment), and <strong>Load Plans</strong> (the master blueprint tying them all together).
          </p>
        </div>
      </Card>

      <div className="flex items-center gap-4 mb-6">
        <div className="h-px bg-gray-200 flex-1" />
        <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">The Daily Workflow</span>
        <div className="h-px bg-gray-200 flex-1" />
      </div>

      <div className="relative">

        {/* Step 1: Deliveries */}
        <GuideSection step={1} icon={Package} title="Enter Deliveries">
          <p>
            Everything starts with a delivery. A delivery represents an order going to a specific customer. 
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Navigate to the <strong>Deliveries</strong> tab.</li>
            <li>Add new deliveries including customer details and address.</li>
            <li>Add specific items (e.g., pallets, boxes, crates) to the delivery. LoadFlow will automatically calculate the total weight.</li>
          </ul>
        </GuideSection>

        {/* Step 2: Assets & Personnel */}
        <GuideSection step={2} icon={Truck} title="Manage Trucks & Drivers">
          <p>
            Before you can ship a delivery, you need assets and personnel available in the system.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="flex items-center gap-2 font-medium text-gray-900 mb-2">
                <Truck className="h-4 w-4 text-primary-500" /> Trucks
              </div>
              <p className="text-sm">Add your vehicles in the <strong>Trucks</strong> tab. Ensure their weight capacities are accurately logged so LoadFlow can warn you if a truck is overloaded.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="flex items-center gap-2 font-medium text-gray-900 mb-2">
                <Users className="h-4 w-4 text-primary-500" /> Drivers
              </div>
              <p className="text-sm">Maintain your roster in the <strong>Drivers</strong> tab. Update their status (Available, On Trip, Off Duty) to keep dispatch operations smooth.</p>
            </div>
          </div>
        </GuideSection>

        {/* Step 3: Load Planning */}
        <GuideSection step={3} icon={ClipboardList} title="Create Load Plans">
          <p>
            A Load Plan is the operational blueprint for a specific trip. This is where dispatchers spend most of their time.
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Go to the <strong>Load Plans</strong> tab and create a new plan for a specific date.</li>
            <li>Assign an available <strong>Truck</strong> and an available <strong>Driver</strong>.</li>
            <li>Select pending deliveries to add to the truck. Order them efficiently for the driver's route.</li>
            <li><strong className="text-primary-600">Smart Capacity:</strong> LoadFlow will automatically tally the weight of all deliveries in the plan and warn you if it exceeds the assigned truck's maximum weight capacity.</li>
          </ul>
        </GuideSection>

        {/* Step 4: Dispatch & Completion */}
        <GuideSection step={4} icon={CheckCircle2} title="Dispatch & Complete">
          <p>
            Once a Load Plan is ready, the operational phase begins.
          </p>
          <div className="space-y-4 mt-4">
            <div className="flex gap-3">
              <div className="mt-1"><ArrowRight className="h-4 w-4 text-gray-400" /></div>
              <div>
                <strong className="text-gray-900 block">Dispatching</strong>
                <span className="text-sm">Change the Load Plan status from "Draft" to "Dispatched". The deliveries inside will automatically update to "In Transit".</span>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="mt-1"><ArrowRight className="h-4 w-4 text-gray-400" /></div>
              <div>
                <strong className="text-gray-900 block">Completion</strong>
                <span className="text-sm">When the driver returns, change the Load Plan status to "Completed". All associated deliveries will be marked "Delivered".</span>
              </div>
            </div>
          </div>
        </GuideSection>
      </div>

      {/* FAQ Section */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5 hover:border-primary-200 transition-colors">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary-500" />
              How are weights calculated?
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              When creating a delivery, you itemize the cargo (e.g., 10 boxes at 5kg each). LoadFlow calculates the total weight for that delivery. When adding deliveries to a Load Plan, LoadFlow sums these totals to ensure the truck's capacity isn't exceeded.
            </p>
          </Card>
          <Card className="p-5 hover:border-primary-200 transition-colors">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary-500" />
              Is my data secure?
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Yes. LoadFlow utilizes a strict Multi-Tenant Architecture. Your company's data (deliveries, drivers, trucks) is completely mathematically isolated from any other organization on the platform.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
