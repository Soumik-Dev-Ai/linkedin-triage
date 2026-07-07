'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Wifi, WifiOff, ExternalLink, X, Loader2, RefreshCw } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import ActivityLog from '@/components/ActivityLog';
import ChatModal from '@/components/ChatModal';
import type { ActivityEntry } from '@/lib/types';

/* ─── Lazy-load Three.js (SSR-incompatible) ─── */
const ThreeBackground = dynamic(() => import('@/components/ThreeBackground'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-0 bg-[oklch(0.11_0.01_260)]" />,
});

/* ─── Polling Interval (ms) ─── */
const POLL_INTERVAL = 30_000;
const AUTH_POLL_INTERVAL = 2_000; // Poll auth status every 2s

export default function Dashboard() {
  /* ─── Core State ─── */
  const [accountId, setAccountId] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<ActivityEntry | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Developer Mode
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [devLoading, setDevLoading] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<string | null>(null);

  // Safe mode & terminal logs (must be declared before handleSendDraft)
  const [safeMode, setSafeMode] = useState(true); // Default to true for safety
  const [terminalLogs, setTerminalLogs] = useState<string[]>(['[System] Awaiting LinkedIn connection...']);

  const addTerminalLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setTerminalLogs(prev => [...prev.slice(-49), `[${timestamp}] ${message}`]);
  }, []);

  // Handler to send a draft reply
  const handleSendDraft = useCallback(async (id: string, chatId: string, draftReply: string) => {
    try {
      const res = await fetch('/api/send-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, replyText: draftReply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send draft');
      // Update activity log: mark as sent and change action label
      setActivityLog((prev) =>
        prev.map((e) => (e.id === id ? { ...e, sent: true, action: `SENT: ${draftReply}` } : e))
      );
      setToast('Message sent successfully!');
      addTerminalLog('[System] Draft sent and recorded.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error sending draft';
      setToast(`Error: ${msg}`);
      addTerminalLog(`[Error] ${msg}`);
    }
    // Auto-hide toast after 3 seconds
    setTimeout(() => setToast(null), 3000);
  }, [addTerminalLog]);

  // Toast UI element (placed near top of return)
  const toastElement = toast ? (
    <div className="fixed top-4 right-4 bg-black/80 text-white px-4 py-2 rounded shadow-lg z-50">
      {toast}
    </div>
  ) : null;

  /* ─── UI State ─── */
  const [isConnecting, setIsConnecting] = useState(false);
  const [isKilling, setIsKilling] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [manualAccountId, setManualAccountId] = useState('');
  const [connectStep, setConnectStep] = useState<'idle' | 'opening' | 'waiting' | 'polling'>('idle');

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);

  /* ─── Restore session from sessionStorage on mount ─── */
  useEffect(() => {
    try {
      // Check if we're returning from auth-success redirect
      const authSession = sessionStorage.getItem('triage_auth_session');
      if (authSession) {
        sessionStorage.removeItem('triage_auth_session');
        // Instead of polling the webhook (which can fail on localhost),
        // we just fetch the accounts since they just connected one!
        // We use setTimeout to ensure handleUseExistingAccount is ready
        setTimeout(() => handleUseExistingAccount(), 100);
        return;
      }

      const stored = sessionStorage.getItem('triage_account_id');
      if (stored) {
        setAccountId(stored);
      }
    } catch {
      // sessionStorage may not be available
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Persist accountId to sessionStorage ─── */
  useEffect(() => {
    try {
      if (accountId) {
        sessionStorage.setItem('triage_account_id', accountId);
      } else {
        sessionStorage.removeItem('triage_account_id');
      }
    } catch {
      // sessionStorage may not be available
    }
  }, [accountId]);

  /* ─── Auth Polling: Check if Unipile webhook has delivered account_id ─── */
  const startAuthPolling = useCallback((sessionToken: string) => {
    setIsConnecting(true);
    setConnectStep('polling');

    let attempts = 0;
    const maxAttempts = 150; // 5 minutes at 2s intervals

    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(authPollRef.current!);
        authPollRef.current = null;
        setIsConnecting(false);
        setConnectStep('idle');
        setErrorMessage('Authentication timed out. Please try again.');
        return;
      }

      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'poll-status', sessionToken }),
        });
        const data = await res.json();

        if (data.status === 'connected' && data.accountId) {
          // Success!
          clearInterval(authPollRef.current!);
          authPollRef.current = null;
          setAccountId(data.accountId);
          setShowConnectModal(false);
          setIsConnecting(false);
          setConnectStep('idle');
          setErrorMessage(null);
        } else if (data.status === 'expired') {
          clearInterval(authPollRef.current!);
          authPollRef.current = null;
          setIsConnecting(false);
          setConnectStep('idle');
          setErrorMessage('Session expired. Please try again.');
        }
        // If 'pending', keep polling
      } catch {
        // Network error — keep trying
      }
    };

    // Poll immediately, then every 2s
    poll();
    authPollRef.current = setInterval(poll, AUTH_POLL_INTERVAL);
  }, []);

  /* ─── Cleanup auth polling on unmount ─── */
  useEffect(() => {
    return () => {
      if (authPollRef.current) {
        clearInterval(authPollRef.current);
        authPollRef.current = null;
      }
    };
  }, []);

  /* ─── Use Existing Account ─── */
  const handleUseExistingAccount = useCallback(async () => {
    // Clear any pending auth polling
    if (authPollRef.current) {
      clearInterval(authPollRef.current);
      authPollRef.current = null;
    }

    setIsConnecting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-accounts' }),
      });

      const data = await response.json();

      if (data.success && data.accounts?.length > 0) {
        // Auto-connect to the first LinkedIn account found
        const account = data.accounts[0];
        setAccountId(account.id || account.account_id);
        setShowConnectModal(false);
        setErrorMessage(null);
      } else if (data.success && data.accounts?.length === 0) {
        setErrorMessage('No LinkedIn accounts found. Please connect one first.');
      } else {
        setErrorMessage(data.error || 'Failed to fetch accounts');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch accounts');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /* ─── Listen for popup postMessage (backup mechanism) ─── */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UNIPILE_AUTH_COMPLETE') {
        // Instead of relying on a webhook that might fail on localhost,
        // just fetch the connected accounts directly since they just linked it!
        handleUseExistingAccount();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleUseExistingAccount]);



  /* ─── Process Loop: Fetch, classify, reply ─── */
  const processLoop = useCallback(async () => {
    if (!accountId || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setErrorMessage(null);
    addTerminalLog(safeMode ? '[System] Initiating process loop (SAFE MODE)...' : '[System] Initiating process loop (LIVE MODE)...');
    addTerminalLog('[Network] Fetching unread messages from Unipile...');

    try {
      const response = await fetch('/api/process-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, safeMode }),
      });

      const data = await response.json();

      if (!response.ok) {
        addTerminalLog(`[Error] API returned status ${response.status}`);
        setErrorMessage(data.error || `API error (${response.status})`);
        return;
      }

      if (data.error && data.entries?.length === 0) {
        // Non-fatal error (e.g., rate limited)
        addTerminalLog(`[Warning] ${data.error}`);
        setErrorMessage(data.error);
      }

      if (data.entries && data.entries.length > 0) {
        addTerminalLog(`[LLM] Analyzed ${data.entries.length} messages using cascade.`);
        addTerminalLog('[Action] Auto-replies dispatched successfully.');
        setActivityLog((prev) => {
          const updated = [...prev];
          data.entries.forEach((newEntry: ActivityEntry) => {
            const idx = updated.findIndex(p => p.chatId === newEntry.chatId);
            if (idx >= 0) {
              const oldEntry = updated[idx];
              // Only update if it hasn't been sent manually by the user, OR if a brand new unread message arrived in the same chat
              if (!oldEntry.sent || oldEntry.messagePreview !== newEntry.messagePreview) {
                updated[idx] = newEntry;
              }
            } else {
              updated.unshift(newEntry);
            }
          });
          return updated;
        });
      } else if (!data.error) {
        addTerminalLog('[System] No unread messages found.');
      }

      setLastPollTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    } catch (error) {
      console.error('[Dashboard] Process loop error:', error);
      addTerminalLog('[Error] Network error during process loop.');
      setErrorMessage(
        error instanceof Error ? error.message : 'Network error — retrying next cycle'
      );
    } finally {
      isProcessingRef.current = false;
    }
  }, [accountId, safeMode, addTerminalLog]);

  /* ─── Polling Lifecycle ─── */
  useEffect(() => {
    if (accountId) {
      // Run immediately on connect
      processLoop();

      // Then every 30 seconds
      pollIntervalRef.current = setInterval(processLoop, POLL_INTERVAL);
      setIsPolling(true);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setIsPolling(false);
      };
    } else {
      setIsPolling(false);
    }
  }, [accountId, processLoop]);

  /* ─── Tab close cleanup ─── */
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Attempt to kill session on tab close
      if (accountId) {
        navigator.sendBeacon(
          '/api/kill-session',
          JSON.stringify({ account_id: accountId })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [accountId]);

  /* ─── Connect Account ─── */
  const handleConnect = async () => {
    setShowConnectModal(true);
  };

  const handleConnectViaAuth = async () => {
    setIsConnecting(true);
    setConnectStep('opening');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-auth' }),
      });

      const data = await response.json();

      if (data.success && data.authUrl && data.sessionToken) {
        setConnectStep('waiting');

        // Open in a new tab (more reliable than popup on most browsers)
        const authWindow = window.open(data.authUrl, '_blank');

        if (!authWindow) {
          // Popup blocked — redirect in same window instead
          // Store session token so we can resume when they return
          sessionStorage.setItem('triage_auth_session', data.sessionToken);
          window.location.href = data.authUrl;
          return;
        }

        // Start polling for webhook completion
        startAuthPolling(data.sessionToken);
      } else {
        setErrorMessage(data.error || 'Failed to create auth link');
        setIsConnecting(false);
        setConnectStep('idle');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
      setIsConnecting(false);
      setConnectStep('idle');
    }
  };

  const handleManualConnect = async () => {
    if (!manualAccountId.trim()) return;

    setIsConnecting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set-account',
          accountId: manualAccountId.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAccountId(data.accountId);
        setShowConnectModal(false);
        setManualAccountId('');
      } else {
        setErrorMessage(data.error || 'Invalid account ID');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  /* ─── Kill Session ─── */
  const handleKillSession = async () => {
    if (!accountId) return;

    setIsKilling(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/kill-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });

      const data = await response.json();

      if (!data.success) {
        console.error('[Dashboard] Kill session failed:', data.error);
        // Still clear local state even if API fails
      }
    } catch (error) {
      console.error('[Dashboard] Kill session error:', error);
    } finally {
      // Always flush state
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      setAccountId(null);
      setActivityLog([]);
      setIsPolling(false);
      setLastPollTime(null);
      setErrorMessage(null);
      setIsKilling(false);

      // Flush sessionStorage
      try {
        sessionStorage.removeItem('triage_account_id');
        sessionStorage.clear();
      } catch {
        // ignore
      }
    }
  };

  /* ─── Cancel Auth ─── */
  const handleCancelAuth = () => {
    if (authPollRef.current) {
      clearInterval(authPollRef.current);
      authPollRef.current = null;
    }
    setIsConnecting(false);
    setConnectStep('idle');
    setErrorMessage(null);
  };

  /* ─── Mouse Movement Tracker for Spotlight ─── */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    target.style.setProperty('--mouse-x', `${x}px`);
    target.style.setProperty('--mouse-y', `${y}px`);
  }, []);

  return (
    <div className="min-h-screen bg-[oklch(0.11_0.01_260)] text-zinc-100 font-sans selection:bg-[#9d4edd]/30 relative overflow-hidden" onMouseMove={handleMouseMove}>
      {/* ─── Z-0: 3D Background ─── */}
      <ThreeBackground />

      {/* ─── Z-10: Dashboard UI ─── */}
      <div className="relative z-10 min-h-screen flex">
        {/* Sidebar */}
        <Sidebar
          accountId={accountId}
          isPolling={isPolling}
          activityLog={activityLog}
          onConnect={() => setShowConnectModal(true)}
          onKillSession={handleKillSession}
          isConnecting={isConnecting}
          isKilling={isKilling}
          lastPollTime={lastPollTime}
          errorMessage={errorMessage}
          terminalLogs={terminalLogs}
          onCheckAgain={processLoop}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          isDeveloper={isDeveloper}
          onDevLoginClick={() => setShowDevModal(true)}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-screen">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Shield size={14} className="text-zinc-500" />
                <span className="text-[10px] tracking-header text-zinc-500">
                  ZERO-RETENTION MODE
                </span>
              </div>
              
              <button
                onClick={() => setSafeMode(!safeMode)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-md border text-[10px] tracking-header transition-all ${
                  safeMode 
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                    : 'border-red-500/30 bg-red-500/10 text-red-400'
                }`}
                title={safeMode ? "Dry run active. No replies will be sent." : "LIVE MODE. Real replies will be sent."}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${safeMode ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                {safeMode ? 'SAFE MODE: ON' : 'LIVE MODE'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {accountId ? (
                <div className="flex items-center gap-1.5 text-emerald-500/80">
                  <Wifi size={12} className="animate-pulse" />
                  <span className="text-[10px] tracking-header font-bold" style={{ textShadow: '0 0 8px rgba(16,185,129,0.5)' }}>CONNECTED</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-zinc-600">
                  <WifiOff size={12} />
                  <span className="text-[10px] tracking-header">OFFLINE</span>
                </div>
              )}
            </div>
          </div>

          {/* Activity Log */}
          {toastElement}
          <ActivityLog 
            entries={activeCategory === 'ALL' ? activityLog : activityLog.filter(e => e.category === activeCategory)} 
            isPolling={isPolling} 
            onSendDraft={handleSendDraft} 
            onRowClick={setSelectedEntry}
            safeMode={safeMode}
            isDeveloper={isDeveloper}
            onCategoryChange={(id, newCategory) => {
              setActivityLog(prev => prev.map(e => e.id === id ? { ...e, category: newCategory as any } : e));
            }}
          />
        </main>
      </div>

      {/* ─── Modals ─── */}
      <ChatModal 
        entry={selectedEntry} 
        onClose={() => setSelectedEntry(null)} 
        onSendDraft={(chatId) => {
          if (selectedEntry && selectedEntry.draftReply) {
            handleSendDraft(selectedEntry.id, chatId, selectedEntry.draftReply);
          }
        }}
      />

      {/* ─── Developer Login Modal ─── */}
      <AnimatePresence>
        {showDevModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'oklch(0 0 0 / 0.65)', backdropFilter: 'blur(12px)' }}
            onClick={() => setShowDevModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="glass-panel glow-border w-full max-w-sm p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-zinc-100 tracking-wide">Developer Access</h3>
                <button
                  onClick={() => setShowDevModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10"
                >
                  <X size={14} className="text-zinc-300" />
                </button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setDevLoading(true);
                try {
                  const res = await fetch('/api/dev-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: devEmail, password: devPassword })
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setIsDeveloper(true);
                    setShowDevModal(false);
                    setToast('Developer Mode Activated');
                  } else {
                    setToast(data.error || 'Login failed');
                  }
                } finally {
                  setDevLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Email</label>
                  <input type="email" value={devEmail} onChange={e => setDevEmail(e.target.value)} required className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-sm text-zinc-200 outline-none focus:border-[#c77dff]/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Password</label>
                  <input type="password" value={devPassword} onChange={e => setDevPassword(e.target.value)} required className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-sm text-zinc-200 outline-none focus:border-[#c77dff]/50" />
                </div>
                <button disabled={devLoading} type="submit" className="w-full py-2 bg-[#c77dff]/20 hover:bg-[#c77dff]/30 border border-[#c77dff]/40 text-[#c77dff] rounded-md text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 mt-4">
                  {devLoading ? 'Verifying...' : 'Login'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Connect Modal ─── */}
      <AnimatePresence>
        {showConnectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'oklch(0 0 0 / 0.65)', backdropFilter: 'blur(12px)' }}
            onClick={() => !isConnecting && setShowConnectModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="glass-panel glass-panel-hover glow-border w-full max-w-md p-7"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 tracking-wide drop-shadow-md">
                    Connect LinkedIn Account
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1.5">
                    Via Unipile hosted authentication
                  </p>
                </div>
                <button
                  onClick={() => { handleCancelAuth(); setShowConnectModal(false); }}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
                >
                  <X size={14} className="text-zinc-300" />
                </button>
              </div>

              {/* Connection Steps */}
              <div className="space-y-5">
                {/* Step Indicator */}
                {connectStep !== 'idle' && (
                  <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-5 shadow-inner">
                    <div className="flex items-center gap-4">
                      {connectStep === 'polling' ? (
                        <div className="relative">
                          <RefreshCw size={18} className="text-[#c77dff] animate-spin" />
                          <div className="absolute inset-0 bg-[#c77dff] blur-md opacity-40 rounded-full animate-pulse" />
                        </div>
                      ) : (
                        <Loader2 size={18} className="text-zinc-400 animate-spin" />
                      )}
                      <div>
                        <p className="text-xs text-zinc-200 font-semibold tracking-wide">
                          {connectStep === 'opening' && 'Creating auth link...'}
                          {connectStep === 'waiting' && 'Opening LinkedIn login...'}
                          {connectStep === 'polling' && 'Waiting for authentication...'}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                          {connectStep === 'polling'
                            ? 'Complete the login in the new tab. This will auto-detect when done.'
                            : 'Please wait...'}
                        </p>
                      </div>
                    </div>
                    {connectStep === 'polling' && (
                      <button
                        onClick={handleCancelAuth}
                        className="mt-4 w-full py-2.5 px-4 rounded-lg text-[10px] font-bold tracking-widest uppercase bg-white/5 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.98]"
                      >
                        CANCEL
                      </button>
                    )}
                  </div>
                )}

                {/* Option 1: Hosted Auth */}
                {connectStep === 'idle' && (
                  <>
                    <button
                      onClick={handleConnectViaAuth}
                      disabled={isConnecting}
                      className="connect-button w-full py-3.5 px-4 rounded-xl text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2.5 disabled:opacity-50"
                    >
                      <ExternalLink size={14} />
                      CONNECT VIA LINKEDIN
                    </button>

                    {/* Option 1b: Use Existing Account */}
                    <button
                      onClick={handleUseExistingAccount}
                      disabled={isConnecting}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold tracking-widest uppercase bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 active:scale-[0.98]"
                    >
                      <RefreshCw size={13} />
                      USE EXISTING ACCOUNT
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 py-1">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-500">
                        OR ENTER MANUALLY
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/10 to-transparent" />
                    </div>

                    {/* Option 2: Manual Account ID */}
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={manualAccountId}
                        onChange={(e) => setManualAccountId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleManualConnect()}
                        placeholder="Paste your Unipile account_id"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#9d4edd] focus:ring-1 focus:ring-[#9d4edd]/30 transition-all font-mono shadow-inner"
                      />
                      <button
                        onClick={handleManualConnect}
                        disabled={!manualAccountId.trim() || isConnecting}
                        className="w-full py-3 px-4 rounded-xl text-xs font-bold tracking-widest uppercase bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 hover:border-white/20 hover:text-zinc-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
                      >
                        CONNECT WITH ACCOUNT ID
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Error Display */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-md"
                  >
                    <p className="text-xs text-red-400 font-medium">{errorMessage}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Privacy Note */}
              <p className="text-[10px] text-zinc-500 text-center mt-6 leading-relaxed font-medium">
                Your credentials are processed by Unipile&apos;s secure infrastructure.
                <br />
                <span className="text-zinc-400">This app stores nothing — zero-retention by design.</span>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
