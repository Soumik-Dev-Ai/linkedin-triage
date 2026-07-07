'use client';

import React from 'react';
import FadeIn from './FadeIn';
import AnimatedHeading from './AnimatedHeading';

interface HeroLandingProps {
  onStartChat: () => void;
}

export default function HeroLanding({ onStartChat }: HeroLandingProps) {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4"
      />

      {/* Foreground Content */}
      <div className="relative z-10 w-full h-full flex flex-col px-6 md:px-12 lg:px-16 pt-6 pb-12 lg:pb-16">
        
        {/* Navbar */}
        <nav className="liquid-glass rounded-xl px-4 py-2 flex items-center justify-between">
          <div className="text-2xl font-semibold tracking-tight">VEX</div>
          
          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#" className="hover:text-gray-300 transition-colors">Story</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Investing</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Building</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Advisory</a>
          </div>

          <button 
            onClick={onStartChat}
            className="bg-white text-black px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Start a Chat
          </button>
        </nav>

        {/* Hero Content (Pushed to bottom) */}
        <div className="flex-1 flex flex-col justify-end">
          <div className="lg:grid lg:grid-cols-2 lg:items-end gap-8">
            
            {/* Left Column */}
            <div>
              <AnimatedHeading 
                text="Shaping tomorrow\nwith vision and action."
                className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-normal mb-4"
                style={{ letterSpacing: '-0.04em' }}
              />

              <FadeIn delayMs={800} durationMs={1000}>
                <p className="text-base md:text-lg text-gray-300 mb-5">
                  We back visionaries and craft ventures that define what comes next.
                </p>
              </FadeIn>

              <FadeIn delayMs={1200} durationMs={1000} className="flex flex-wrap gap-4">
                <button 
                  onClick={onStartChat}
                  className="bg-white text-black px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Start a Chat
                </button>
                <button className="liquid-glass border border-white/20 text-white px-8 py-3 rounded-lg font-medium hover:bg-white hover:text-black transition-colors">
                  Explore Now
                </button>
              </FadeIn>

              <FadeIn delayMs={1600} durationMs={1000} className="mt-6 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500/80 pulse-dot"></div>
                <span className="text-[10px] md:text-xs font-medium text-emerald-400/80 tracking-widest uppercase">
                  Zero-Retention Policy • No Database • Total Privacy
                </span>
              </FadeIn>
            </div>

            {/* Right Column */}
            <div className="flex items-end justify-start lg:justify-end mt-8 lg:mt-0">
              <FadeIn delayMs={1400} durationMs={1000}>
                <div className="liquid-glass border border-white/20 px-6 py-3 rounded-xl">
                  <span className="text-lg md:text-xl lg:text-2xl font-light">
                    Investing. Building. Advisory.
                  </span>
                </div>
              </FadeIn>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
