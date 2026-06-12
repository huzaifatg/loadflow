'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Package, Truck, ClipboardList, Shield } from 'lucide-react';

const metrics = [
  {
    label: 'Isolated Architecture',
    value: 'Multi-Tenant',
    suffix: ' SaaS',
    icon: Shield,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    label: 'Asset Management',
    value: 'Fleet',
    suffix: ' Ops',
    icon: Truck,
    gradient: 'from-indigo-500 to-violet-600',
  },
  {
    label: 'End-to-End Tracking',
    value: 'Dispatch',
    suffix: ' Flow',
    icon: ClipboardList,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    label: 'Granular Control',
    value: 'Itemized',
    suffix: ' Loads',
    icon: Package,
    gradient: 'from-purple-500 to-fuchsia-600',
  },
];

function MetricCard({
  metric,
}: {
  metric: (typeof metrics)[0];
}) {
  return (
    <div className="relative glass-card rounded-2xl p-8 text-center group hover:bg-white/[0.04] transition-all duration-300">
      {/* Icon */}
      <div
        className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${metric.gradient} shadow-lg mb-5 group-hover:scale-110 transition-transform duration-300`}
      >
        <metric.icon className="h-5 w-5 text-white" />
      </div>

      {/* Value */}
      <div className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
        {metric.value}
        <span className="text-primary-400">{metric.suffix}</span>
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-slate-400">{metric.label}</p>
    </div>
  );
}

export function LandingStats() {
  const sectionRef = useRef<HTMLElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section
      id="metrics"
      ref={sectionRef}
      className="relative py-24 sm:py-32 bg-slate-950 overflow-hidden reveal"
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-indigo-950/10 to-slate-950" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/5 rounded-full blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16 sm:mb-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-400 mb-3">
            Core Capabilities
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Built for <span className="gradient-text">scale</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400 leading-relaxed">
            LoadFlow is engineered to handle the demands of growing logistics operations.
          </p>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              metric={metric}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
