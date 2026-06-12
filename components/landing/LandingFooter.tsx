'use client';

import React from 'react';
import Link from 'next/link';
import { BoxesIcon } from 'lucide-react';

const productLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Metrics', href: '#metrics' },
];

const platformLinks = [
  { label: 'Sign In', href: '/login' },
  { label: 'Explore Demo', href: '/api/demo' },
];

export function LandingFooter() {
  return (
    <footer className="relative bg-slate-950 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          {/* Brand column */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                <BoxesIcon className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                LoadFlow
              </span>
            </Link>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
              The logistics management platform built for operators who need
              visibility, coordination, and control over every delivery.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Product
            </h3>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Platform
            </h3>
            <ul className="space-y-3">
              {platformLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} LoadFlow. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
