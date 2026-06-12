'use client';

import React, { useEffect, useRef } from 'react';
import {
  Package,
  Truck,
  BarChart3,
  MapPin,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export function LandingShowcase() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const elements = sectionRef.current?.querySelectorAll('.reveal');
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 sm:py-32 bg-slate-950 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16 reveal">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-400 mb-3">
            Operational Visibility
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Your operations at a{' '}
            <span className="gradient-text">glance</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400 leading-relaxed">
            Real-time visibility into every truck, driver, and delivery — from one unified dashboard.
          </p>
        </div>

        {/* Simulated dashboard cards */}
        <div className="reveal grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column — Stats */}
          <div className="space-y-5">
            {/* Stat card 1 */}
            <div className="glass-card rounded-2xl p-6 hover:bg-white/[0.04] transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                  <Package className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Active Deliveries</p>
                  <p className="text-2xl font-bold text-white">247</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <BarChart3 className="h-3 w-3" />
                  +12%
                </span>
                <span className="text-slate-500">vs last week</span>
              </div>
            </div>

            {/* Stat card 2 */}
            <div className="glass-card rounded-2xl p-6 hover:bg-white/[0.04] transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                  <Truck className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Fleet Utilization</p>
                  <p className="text-2xl font-bold text-white">87%</p>
                </div>
              </div>
              {/* Utilization bar */}
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-[87%] bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full animate-fill" />
              </div>
            </div>

            {/* Stat card 3 */}
            <div className="glass-card rounded-2xl p-6 hover:bg-white/[0.04] transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">On-Time Rate</p>
                  <p className="text-2xl font-bold text-white">94.2%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Center column — Activity feed */}
          <div className="glass-card rounded-2xl p-6 hover:bg-white/[0.04] transition-all duration-300">
            <h3 className="text-sm font-semibold text-white mb-5">Live Activity</h3>
            <div className="space-y-4">
              {[
                {
                  icon: Truck,
                  iconColor: 'text-blue-400',
                  iconBg: 'bg-blue-500/10',
                  title: 'Truck T-042 dispatched',
                  subtitle: 'Route: Downtown → Warehouse B',
                  time: '2 min ago',
                },
                {
                  icon: Package,
                  iconColor: 'text-emerald-400',
                  iconBg: 'bg-emerald-500/10',
                  title: 'Delivery #1847 completed',
                  subtitle: 'Customer: Acme Corp',
                  time: '8 min ago',
                },
                {
                  icon: MapPin,
                  iconColor: 'text-amber-400',
                  iconBg: 'bg-amber-500/10',
                  title: 'Driver reassigned',
                  subtitle: 'John M. → Route 7 coverage',
                  time: '15 min ago',
                },
                {
                  icon: Clock,
                  iconColor: 'text-violet-400',
                  iconBg: 'bg-violet-500/10',
                  title: 'Load plan finalized',
                  subtitle: 'Tomorrow, 6 deliveries queued',
                  time: '22 min ago',
                },
                {
                  icon: CheckCircle2,
                  iconColor: 'text-emerald-400',
                  iconBg: 'bg-emerald-500/10',
                  title: 'Delivery #1845 confirmed',
                  subtitle: 'Weight: 2,400 kg verified',
                  time: '30 min ago',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}>
                    <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                  </div>
                  <span className="text-[10px] text-slate-600 whitespace-nowrap mt-0.5">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — Today's dispatches */}
          <div className="glass-card rounded-2xl p-6 hover:bg-white/[0.04] transition-all duration-300">
            <h3 className="text-sm font-semibold text-white mb-5">Today&apos;s Dispatches</h3>
            <div className="space-y-3">
              {[
                { truck: 'T-042', driver: 'Ahmed K.', stops: 8, status: 'In Transit', statusColor: 'text-blue-400 bg-blue-500/10' },
                { truck: 'T-015', driver: 'Sarah M.', stops: 5, status: 'Dispatched', statusColor: 'text-amber-400 bg-amber-500/10' },
                { truck: 'T-028', driver: 'James L.', stops: 11, status: 'Completed', statusColor: 'text-emerald-400 bg-emerald-500/10' },
                { truck: 'T-033', driver: 'Maria R.', stops: 6, status: 'In Transit', statusColor: 'text-blue-400 bg-blue-500/10' },
                { truck: 'T-007', driver: 'David P.', stops: 9, status: 'Loading', statusColor: 'text-violet-400 bg-violet-500/10' },
              ].map((dispatch, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-slate-300">
                    {dispatch.truck}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200">{dispatch.driver}</p>
                    <p className="text-[11px] text-slate-500">{dispatch.stops} stops</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-md ${dispatch.statusColor}`}>
                    {dispatch.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
