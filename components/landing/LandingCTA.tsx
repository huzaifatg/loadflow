'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function LandingCTA() {
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
      { threshold: 0.1 }
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
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-indigo-950/30 to-slate-950" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-600/10 rounded-full blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Card background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/40 via-slate-900/80 to-indigo-950/60" />
          <div className="absolute inset-0 glass-card" />

          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/10 rounded-full blur-[80px]" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-[60px]" />

          {/* Content */}
          <div className="relative px-8 py-16 sm:px-16 sm:py-24 text-center">
            <div className="reveal">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white max-w-3xl mx-auto leading-tight">
                Ready to streamline your{' '}
                <span className="gradient-text">logistics?</span>
              </h2>
              <p className="mt-5 text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
                Join the operators who&apos;ve replaced spreadsheets and manual
                coordination with LoadFlow&apos;s unified platform.
              </p>

              {/* CTAs */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/api/demo"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-slate-900 shadow-xl hover:bg-slate-100 transition-all duration-300 hover:-translate-y-0.5 w-full sm:w-auto"
                >
                  Explore Demo
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 hover:border-white/25 transition-all duration-300 w-full sm:w-auto"
                >
                  Sign In
                </Link>
              </div>

              {/* Trust note */}
              <p className="mt-6 text-xs text-slate-500">
                Free to start · No credit card required · Set up in under 5 minutes
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
