'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BoxesIcon, Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Metrics', href: '#metrics' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-slate-950/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/10'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white transition-transform group-hover:scale-105">
              <BoxesIcon className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              LoadFlow
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors duration-200 px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/api/demo"
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 hover:bg-primary-500 transition-all duration-200 hover:shadow-primary-600/40 hover:-translate-y-0.5"
            >
              Explore Demo
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-slate-950/95 backdrop-blur-xl animate-fade-in">
          <div className="px-6 py-4 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
              <Link
                href="/login"
                className="block px-3 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/api/demo"
                className="block text-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 transition-colors"
              >
                Explore Demo
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
