'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Wifi, WifiOff, ExternalLink, X, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import ActivityLog from '@/components/ActivityLog';
import ChatModal from '@/components/ChatModal';
import type { ActivityEntry, LLMClassification } from '@/lib/types';
import AnimatedHeading from '@/components/AnimatedHeading';

/* ─── Lazy-load Three.js (SSR-incompatible) ─── */
const ThreeBackground = dynamic(() => import('@/components/ThreeBackground'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-0 bg-[oklch(0.11_0.01_260)]" />,
});

/* ─── Polling Interval (ms) ─── */
const POLL_INTERVAL = 30_000;

type ScrapeMessage = Record<string, unknown>;
type SendReplyResult = { success: boolean; error?: string };

/* ─── Extension Bridge Helpers ─── */
async function requestExtensionScrape(): Promise<{ success: boolean; messages: ScrapeMessage[]; error?: string }> {
  return new Promise((resolve, reject) => {
    const handler = (event: Event) => {
      window.removeEventListener('EXTENSION_SCRAPE_RESULT', handler);
      const detail = (event as CustomEvent).detail;
      if (detail?.success) {
        resolve(detail);
      } else {
        reject(new Error(detail?.error || 'Scrape failed'));
      }
    };
    window.addEventListener('EXTENSION_SCRAPE_RESULT', handler);
    window.dispatchEvent(new CustomEvent('EXTENSION_SCRAPE_REQUEST', {
      detail: { origin: window.location.origin }
    }));
    setTimeout(() => {
      window.removeEventListener('EXTENSION_SCRAPE_RESULT', handler);
      reject(new Error('Extension scrape timed out'));
    }, 30000);
  });
}

async function requestSendReply(chatId: string, draftReply: string): Promise<SendReplyResult> {
  return new Promise((resolve, reject) => {
    const handler = (event: Event) => {
      window.removeEventListener('SEND_REPLY_RESULT', handler);
      resolve((event as CustomEvent).detail);
    };
    window.addEventListener('SEND_REPLY_RESULT', handler);
    window.dispatchEvent(new CustomEvent('SEND_REPLY', {
      detail: { chatId, draftReply, origin: window.location.origin }
    }));
    setTimeout(() => {
      window.removeEventListener('SEND_REPLY_RESULT', handler);
      reject(new Error('Send reply timed out'));
    }, 15000);
  });
}


export default function Dashboard() {
  /* ─── Core State ─── */
  const [bridgeReady, setBridgeReady] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
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
  const [safeMode, setSafeMode] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState<string[]>(['[System] Awaiting LinkedIn connection...']);

  const addTerminalLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setTerminalLogs(prev => [...prev.slice(-49), `[${timestamp}] ${message}`]);
  }, []);

  // Handler to send a draft reply
  const handleSendDraft = useCallback(async (id: string, chatId: string, draftReply: string) => {
    if (safeMode) {
      setToast('Safe mode — draft not sent');
      addTerminalLog('[System] Safe mode active — skipped sending draft.');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    try {
      const result = await requestSendReply(chatId, draftReply);
      if (result.success) {
        setActivityLog((prev) =>
          prev.map((e) => (e.id === id ? { ...e, sent: true, action: `SENT: ${draftReply}` } : e))
        );
        setToast('Message sent successfully!');
        addTerminalLog('[System] Draft sent and recorded.');
      } else {
        setToast(`Send failed: ${result.error || 'Unknown error'}`);
        addTerminalLog(`[Error] Send failed: ${result.error || 'Unknown error'}`);
      }
    } catch {
      setToast('Send timed out or failed');
      addTerminalLog('[Error] Send timed out.');
    }
    setTimeout(() => setToast(null), 3000);
  }, [safeMode, addTerminalLog]);

  // Toast UI element (placed near top of return)
  const toastElement = toast ? (
    <div className="fixed top-4 right-4 bg-black/80 text-white px-4 py-2 rounded shadow-lg z-50">
      {toast}
    </div>
  ) : null;

  /* ─── UI State ─── */
  const [isConnecting, setIsConnecting] = useState(false);
  const [isKilling, setIsKilling] = useState(false);


  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);

  /* ─── Detect extension bridge on mount ─── */
  useEffect(() => {
    const handleBridgeReady = () => {
      setBridgeReady(true);
      addTerminalLog('[System] Extension bridge detected.');
    };
    window.addEventListener('EXTENSION_BRIDGE_READY', handleBridgeReady);
    return () => window.removeEventListener('EXTENSION_BRIDGE_READY', handleBridgeReady);
  }, [addTerminalLog]);

  /* ─── Connect to Extension Bridge ─── */
  const handleStartTriage = useCallback(async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    addTerminalLog('[System] Requesting data from extension bridge...');

    if (!bridgeReady) {
      setErrorMessage('Extension bridge not detected. Please install the AI Triage Bridge extension and refresh.');
      setIsConnecting(false);
      return;
    }

    setIsConnecting(false);
    setIsPolling(true);
    addTerminalLog('[System] Extension bridge active. Starting message triage...');
    // The polling lifecycle effect handles calling processLoop
  }, [bridgeReady, addTerminalLog]);

  /* ─── Process Loop: Scrape via extension, classify, reply ─── */
  const processLoop = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsScraping(true);
    setErrorMessage(null);
    addTerminalLog(safeMode ? '[System] Scraping messages via extension (SAFE MODE)...' : '[System] Scraping messages via extension (LIVE MODE)...');

    try {
      addTerminalLog('[Network] Requesting scrape from extension bridge...');
      const scrapeResult = await requestExtensionScrape();

      if (!scrapeResult.success || !scrapeResult.messages || scrapeResult.messages.length === 0) {
        addTerminalLog('[System] No messages found on LinkedIn.');
        isProcessingRef.current = false;
        setIsScraping(false);
        return;
      }

      addTerminalLog(`[Network] Found ${scrapeResult.messages.length} conversations. Sending to LLM cascade...`);

      const response = await fetch('/api/process-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: scrapeResult.messages, safeMode }),
      });

      const data = await response.json();

      if (!response.ok) {
        addTerminalLog(`[Error] API returned status ${response.status}`);
        setErrorMessage(data.error || `API error (${response.status})`);
        isProcessingRef.current = false;
        setIsScraping(false);
        return;
      }

      if (data.error && data.entries?.length === 0) {
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
      setIsScraping(false);
    }
  }, [safeMode, addTerminalLog]);

  /* ─── Polling Lifecycle ─── */
  useEffect(() => {
    if (isPolling && bridgeReady) {
      queueMicrotask(() => processLoop());
      pollIntervalRef.current = setInterval(processLoop, POLL_INTERVAL);
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [isPolling, bridgeReady, processLoop]);

  /* ─── Kill Session ─── */
  const handleKillSession = async () => {
    setIsKilling(true);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setActivityLog([]);
    setIsPolling(false);
    setLastPollTime(null);
    setErrorMessage(null);
    setIsKilling(false);
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
          accountId={isPolling ? 'connected' : null}
          isPolling={isPolling}
          activityLog={activityLog}
          onConnect={handleStartTriage}
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
              {isPolling ? (
                <div className="flex items-center gap-1.5 text-emerald-500/80">
                  <Wifi size={12} className={isScraping ? 'animate-pulse' : ''} />
                  <span className="text-[10px] tracking-header font-bold" style={{ textShadow: '0 0 8px rgba(16,185,129,0.5)' }}>CONNECTED</span>
                  {isScraping && <span className="text-[10px] text-zinc-400 ml-1">SCANNING</span>}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-zinc-600">
                  <WifiOff size={12} />
                  <span className="text-[10px] tracking-header">OFFLINE</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          {toastElement}
          
          {isPolling ? (
            <ActivityLog 
              entries={activeCategory === 'ALL' ? activityLog : activityLog.filter(e => e.category === activeCategory)} 
              isPolling={isPolling} 
              onSendDraft={handleSendDraft} 
              onRowClick={setSelectedEntry}
              safeMode={safeMode}
              isDeveloper={isDeveloper}
              onCategoryChange={(id, newCategory) => {
                setActivityLog(prev => prev.map(e => e.id === id ? { ...e, category: newCategory as LLMClassification['category'] } : e));
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#c77dff]/5 to-transparent pointer-events-none" />
              
              <div className="max-w-2xl w-full text-center space-y-8 relative z-10 -mt-16">
                <AnimatedHeading 
                  text="AI Inbox Triage"
                  className="text-4xl md:text-6xl font-light mb-2 text-white"
                  style={{ letterSpacing: '-0.04em' }}
                />
                <p className="text-zinc-400 text-sm md:text-base mb-8 max-w-xl mx-auto leading-relaxed">
                  Seamlessly categorize and draft responses for your incoming communications.
                </p>

                <div className="relative inline-block group mt-8">
                  <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <button
                    onClick={handleStartTriage}
                    disabled={isConnecting}
                    className="relative bg-white text-black px-12 py-5 rounded-2xl text-xs font-bold tracking-[0.2em] uppercase hover:scale-105 hover:bg-zinc-100 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)] flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="animate-spin w-5 h-5" />
                        COLLECTING...
                      </>
                    ) : (
                      <>
                        COLLECT DETAILS
                        <ExternalLink size={16} />
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-24 p-6 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md max-w-2xl mx-auto text-left flex gap-5 items-start shadow-2xl">
                  <div className="p-3 bg-emerald-500/10 rounded-xl">
                    <Shield size={24} className="text-emerald-400 flex-shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-emerald-400 font-bold tracking-widest text-[11px] mb-2">ZERO-RETENTION POLICY</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      No data is stored. If you do not delete the data yourself, it will automatically get deleted as this extension strictly follows a zero retention policy. So no data is being stored.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
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

    </div>
  );
}
