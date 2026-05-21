'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500 mb-6 shadow-sm">
        <AlertTriangle className="h-10 w-10" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">
        Something went wrong
      </h1>
      <p className="text-gray-500 mb-8 max-w-md">
        We encountered a runtime error loading this dashboard page. This might be due to a database connection issue or an unexpected system fault.
      </p>
      
      <div className="bg-red-50/50 p-4 rounded-lg border border-red-100 text-left max-w-2xl w-full mb-8 overflow-auto">
        <p className="text-sm font-mono text-red-800 break-words">{error.message}</p>
      </div>

      <div className="flex gap-4">
        <Button onClick={() => window.location.href = '/'}>
          Return Home
        </Button>
        <Button variant="secondary" onClick={() => reset()}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
