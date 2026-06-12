'use client';

import React, { useEffect, useRef } from 'react';
import { UserPlus, Settings2, Rocket } from 'lucide-react';

const steps = [
  {
    step: '01',
    title: 'Create Your Account',
    description:
      'Sign up in 30 seconds. No credit card required. Get instant access to your logistics command center.',
    icon: UserPlus,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    step: '02',
    title: 'Configure Your Fleet',
    description:
      'Add your trucks, register your drivers, and set up delivery routes. Import existing data or start fresh.',
    icon: Settings2,
    gradient: 'from-indigo-500 to-violet-600',
  },
  {
    step: '03',
    title: 'Start Dispatching',
    description:
      'Plan loads, schedule dispatches, and track everything in real-time. Your operations running smoother from day one.',
    icon: Rocket,
    gradient: 'from-violet-500 to-purple-600',
  },
];

export function LandingHowItWorks() {
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
      id="how-it-works"
      ref={sectionRef}
      className="relative py-24 sm:py-32 bg-slate-950 overflow-hidden"
    >
      {/* Subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto reveal">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-400 mb-3">
            Get Started
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Up and running in{' '}
            <span className="gradient-text">minutes</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400 leading-relaxed">
            No complex setup. No week-long onboarding. Just sign up and start managing.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-16 sm:mt-20 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-5">
          {steps.map((item, idx) => (
            <div
              key={item.step}
              className="reveal relative"
              style={{ transitionDelay: `${idx * 150}ms` }}
            >
              {/* Connector line (desktop only) */}
              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute top-14 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-gradient-to-r from-primary-500/30 to-transparent z-0" />
              )}

              <div className="relative glass-card rounded-2xl p-8 text-center h-full flex flex-col items-center hover:bg-white/[0.04] transition-all duration-300">
                {/* Step number */}
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400/60 mb-5">
                  Step {item.step}
                </div>

                {/* Icon */}
                <div
                  className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} shadow-xl mb-6`}
                >
                  <item.icon className="h-6 w-6 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-3">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
