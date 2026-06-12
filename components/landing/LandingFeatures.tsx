'use client';

import React, { useEffect, useRef } from 'react';
import {
  Package,
  Truck,
  Users,
  ClipboardList,
  Calendar,
  LayoutDashboard,
} from 'lucide-react';

const features = [
  {
    title: 'Delivery Management',
    description:
      'Track every delivery from pending to delivered. Full status workflows with customer details, weight tracking, and scheduling.',
    icon: Package,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    title: 'Fleet Coordination',
    description:
      'Monitor your entire fleet in real-time. Track truck status, capacity utilization, and maintenance schedules at a glance.',
    icon: Truck,
    gradient: 'from-indigo-500 to-violet-600',
  },
  {
    title: 'Driver Management',
    description:
      'Assign drivers, track availability, and manage licenses. Keep your entire team coordinated and operationally compliant.',
    icon: Users,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    title: 'Load Planning',
    description:
      'Build optimized load plans. Assign deliveries to trucks with visual capacity tracking and intelligent weight allocation.',
    icon: ClipboardList,
    gradient: 'from-purple-500 to-fuchsia-600',
  },
  {
    title: 'Dispatch Scheduling',
    description:
      'Schedule dispatches with a visual calendar view. See daily operations at a glance and prevent resource conflicts.',
    icon: Calendar,
    gradient: 'from-fuchsia-500 to-pink-600',
  },
  {
    title: 'Operational Dashboard',
    description:
      'Real-time KPIs — completion rates, active trucks, pending deliveries, and today\'s dispatches unified in one command center.',
    icon: LayoutDashboard,
    gradient: 'from-pink-500 to-rose-600',
  },
];

export function LandingFeatures() {
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
      id="features"
      ref={sectionRef}
      className="relative py-24 sm:py-32 bg-slate-950 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950" />
      <div className="absolute inset-0 grid-pattern opacity-30" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto reveal">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-400 mb-3">
            Platform Capabilities
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Everything you need to{' '}
            <span className="gradient-text">run logistics</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400 leading-relaxed">
            From delivery intake to dispatch execution — LoadFlow covers the
            full operational lifecycle.
          </p>
        </div>

        {/* Feature grid */}
        <div className="mt-16 sm:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, idx) => (
            <div
              key={feature.title}
              className="reveal group relative rounded-2xl glass-card p-7 hover:bg-white/[0.06] transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-600/5"
              style={{ transitionDelay: `${idx * 80}ms` }}
            >
              {/* Icon */}
              <div
                className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg mb-5`}
              >
                <feature.icon className="h-5 w-5 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-300 transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {feature.description}
              </p>

              {/* Hover border glow */}
              <div className="absolute inset-0 rounded-2xl border border-transparent group-hover:border-primary-500/20 transition-colors duration-500 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
