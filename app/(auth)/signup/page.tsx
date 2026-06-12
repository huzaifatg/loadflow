import Link from 'next/link';
import { BoxesIcon, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SignupPage() {
  return (
    <div className="w-full max-w-md">
      {/* Branding */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center justify-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-600/30">
            <BoxesIcon className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            LoadFlow
          </span>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/20 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <Lock className="h-8 w-8 text-slate-500" />
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
          Registration Closed
        </h1>
        
        <p className="text-slate-600 mb-8 leading-relaxed">
          Public registration is currently closed. You can explore the platform's capabilities using our interactive demo environment.
        </p>

        <div className="space-y-4">
          <Link href="/api/demo" className="block w-full">
            <Button className="w-full" size="lg">
              Explore Demo
            </Button>
          </Link>
          
          <Link href="/login" className="block w-full">
            <Button variant="secondary" className="w-full" size="lg">
              Sign In to Existing Account
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
