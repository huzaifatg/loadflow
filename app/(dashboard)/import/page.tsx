import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { CsvImportClient } from '@/components/import/CsvImportClient';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <>
      <PageHeader
        title="Import Deliveries"
        description="Upload a CSV file to bulk-import delivery records."
      />
      <CsvImportClient />
      <div className="max-w-2xl mx-auto mt-6 text-center">
        <Link
          href="/import/history"
          className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          View Import History →
        </Link>
      </div>
    </>
  );
}
