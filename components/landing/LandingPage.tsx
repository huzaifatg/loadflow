'use client';

import React from 'react';
import { LandingNav } from './LandingNav';
import { LandingHero } from './LandingHero';
import { LandingFeatures } from './LandingFeatures';
import { LandingShowcase } from './LandingShowcase';
import { LandingHowItWorks } from './LandingHowItWorks';
import { LandingStats } from './LandingStats';
import { LandingCTA } from './LandingCTA';
import { LandingFooter } from './LandingFooter';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <LandingNav />
      <LandingHero />
      <LandingFeatures />
      <LandingShowcase />
      <LandingHowItWorks />
      <LandingStats />
      <LandingCTA />
      <LandingFooter />
    </div>
  );
}
