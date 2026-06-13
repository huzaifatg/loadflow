'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function LandingHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Background effects */}
      <div className="absolute inset-0">
        {/* Gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />

        {/* Grid pattern */}
        <div className="absolute inset-0 grid-pattern opacity-40" />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/20 rounded-full blur-[128px] animate-glow-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/15 rounded-full blur-[100px] animate-glow-pulse animation-delay-200" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px] animate-glow-pulse animation-delay-500" />

        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.5)_70%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-24 pb-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-4 py-1.5 text-sm font-medium text-primary-300 mb-8 animate-fade-in-up">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-400 animate-glow-pulse" />
            Built for logistics operators
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] animate-fade-in-up animation-delay-100">
            Logistics execution,{' '}
            <span className="gradient-text">reimagined.</span>
          </h1>

          {/* Sub-headline */}
          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animation-delay-200">
            Manage deliveries, coordinate drivers, and optimize your fleet — all from one
            platform built for operators who ship.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-300">
            <Link
              href="/api/demo"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-primary-600/25 hover:bg-primary-500 hover:shadow-primary-600/40 transition-all duration-300 hover:-translate-y-0.5 w-full sm:w-auto"
            >
              Explore Demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-semibold text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300 w-full sm:w-auto"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Hero product visual */}
        <div className="mt-20 relative animate-fade-in-up animation-delay-500">
          {/* Glow behind image */}
          <div className="absolute -inset-4 bg-gradient-to-r from-primary-600/20 via-indigo-500/20 to-violet-500/20 rounded-2xl blur-2xl opacity-60" />

          {/* Dashboard mockup */}
          <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
            {/* Browser chrome */}
            <div className="bg-slate-800/80 backdrop-blur px-4 py-3 flex items-center gap-2 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-slate-700/50 rounded-md px-3 py-1 text-xs text-slate-400 max-w-xs mx-auto text-center">
                  app.loadflow.io/dashboard
                </div>
              </div>
            </div>

            {/* Screenshot */}
            <img
              src="/dashboard-hero.png"
              alt="LoadFlow Dashboard — logistics management platform showing delivery tracking, fleet status, and dispatch scheduling"
              className="w-full"
              loading="eager"
            />

            {/* Gradient fade at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
