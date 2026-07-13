'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const status = error ? 'error' : 'success';

  return (
    <div className="min-h-screen bg-[oklch(0.11_0.01_260)] flex flex-col items-center justify-center text-zinc-400 font-sans">
      {status === 'success' && (
        <>
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm tracking-wide text-emerald-400 font-medium">Authentication Successful</p>
          <p className="text-xs text-zinc-500 mt-2">
            <Link href="/" className="underline hover:text-zinc-400 transition-colors">Return to dashboard</Link>
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p className="text-sm tracking-wide text-red-400 font-medium">Connection Failed</p>
          <p className="text-xs text-zinc-500 mt-2">
            <Link href="/" className="underline hover:text-zinc-400 transition-colors">Return to dashboard</Link> and try again.
          </p>
        </>
      )}
    </div>
  );
}

export default function AuthSuccess() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[oklch(0.11_0.01_260)]" />}>
      <AuthSuccessContent />
    </Suspense>
  );
}
