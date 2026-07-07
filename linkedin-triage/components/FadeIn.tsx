'use client';

import React, { useState, useEffect } from 'react';

interface FadeInProps {
  children: React.ReactNode;
  delayMs?: number;
  durationMs?: number;
  className?: string;
}

export default function FadeIn({ children, delayMs = 0, durationMs = 1000, className = '' }: FadeInProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <div
      className={`transition-opacity ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transitionDuration: `${durationMs}ms`,
        transitionProperty: 'opacity',
        transitionTimingFunction: 'ease-out',
      }}
    >
      {children}
    </div>
  );
}
