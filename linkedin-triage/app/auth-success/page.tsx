'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const sessionToken = searchParams.get('session');
  const accountId = searchParams.get('account_id') || searchParams.get('accountId');
  const error = searchParams.get('error');
  const [status, setStatus] = useState<'success' | 'error' | 'loading'>('loading');

  useEffect(() => {
    if (error) {
      setStatus('error');
      return;
    }

    if (sessionToken) {
      // Auth succeeded — store the session token so main page can poll for it
      try {
        sessionStorage.setItem('triage_auth_session', sessionToken);
      } catch {
        // ignore
      }

      // If Unipile appended account_id to the success redirect, we can manually
      // trigger the webhook endpoint from the frontend. This is crucial for
      // localhost development where Unipile's servers cannot reach localhost!
      if (accountId) {
        fetch(`/api/auth?session=${sessionToken}&account_id=${accountId}`).catch(console.error);
      }

      setStatus('success');

      // Try to close popup if opened as popup, otherwise redirect
      setTimeout(() => {
        if (window.opener) {
          window.opener.postMessage({ type: 'UNIPILE_AUTH_COMPLETE', sessionToken }, '*');
          window.close();
        } else {
          window.location.href = '/';
        }
      }, 1500);
    } else {
      setStatus('error');
    }
  }, [sessionToken, accountId, error]);

  return (
    <div className="min-h-screen bg-[oklch(0.11_0.01_260)] flex flex-col items-center justify-center text-zinc-400 font-sans">
      {status === 'loading' && (
        <>
          <div className="w-8 h-8 rounded-full border-2 border-zinc-500/30 border-t-zinc-400 animate-spin mb-4" />
          <p className="text-sm tracking-wide">Processing...</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm tracking-wide text-emerald-400 font-medium">Account Connected Successfully</p>
          <p className="text-xs text-zinc-500 mt-2">Redirecting to dashboard...</p>
          <p className="text-[10px] text-zinc-600 mt-4">You can safely close this window if it doesn&apos;t close automatically.</p>
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
            <a href="/" className="underline hover:text-zinc-400 transition-colors">Return to dashboard</a> and try again.
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
