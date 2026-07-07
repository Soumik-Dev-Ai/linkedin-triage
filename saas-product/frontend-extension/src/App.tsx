import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Wifi, WifiOff, X, RefreshCw } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ActivityLog from './components/ActivityLog';
import ChatModal from './components/ChatModal';
import type { ActivityEntry } from './lib/types';
import ThreeBackground from './components/ThreeBackground';

export default function App() {
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<ActivityEntry | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [safeMode, setSafeMode] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState<string[]>(['[System] Extension UI loaded. Waiting for LinkedIn tab...']);

  const addTerminalLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setTerminalLogs(prev => [...prev.slice(-49), `[${timestamp}] ${message}`]);
  }, []);

  // Listen for messages from background/content scripts
  useEffect(() => {
    const messageListener = (msg: any) => {
      if (msg.type === 'NEW_ACTIVITY') {
        setActivityLog(prev => [msg.data, ...prev]);
        addTerminalLog(`[System] New message categorized as ${msg.data.category}`);
      } else if (msg.type === 'LOG') {
        addTerminalLog(msg.data);
      }
    };
    
    // Check if chrome.runtime exists (we might be running in a standard Vite dev server without extension APIs)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      return () => chrome.runtime.onMessage.removeListener(messageListener);
    }
  }, [addTerminalLog]);

  const handleSendDraft = useCallback(async (id: string, chatId: string, draftReply: string) => {
    setToast('Sending draft via Content Script...');
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      // Send message to active tab content script to inject the reply
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'SEND_REPLY', chatId, draftReply }, (response) => {
            if (response && response.success) {
              setActivityLog(prev => prev.map(e => e.id === id ? { ...e, sent: true, action: `SENT: ${draftReply}` } : e));
              setToast('Sent!');
              addTerminalLog('[Success] Reply injected into LinkedIn.');
            } else {
              setToast('Failed to send.');
            }
          });
        }
      });
    }
    setTimeout(() => setToast(null), 3000);
  }, [addTerminalLog]);

  return (
    <div className="min-h-screen bg-[oklch(0.11_0.01_260)] text-zinc-100 font-sans selection:bg-[#9d4edd]/30 relative overflow-hidden">
      <ThreeBackground />
      <div className="relative z-10 min-h-screen flex">
        <Sidebar
          accountId="local-extension"
          isPolling={isPolling}
          onConnect={() => {}}
          onKillSession={() => {}}
          isConnecting={false}
          isKilling={false}
          lastPollTime={new Date().toLocaleTimeString()}
          errorMessage={errorMessage}
          terminalLogs={terminalLogs}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          isDeveloper={isDeveloper}
          onDevLoginClick={() => setIsDeveloper(true)}
          activityLog={activityLog}
        />
        <main className="flex-1 flex flex-col min-h-screen">
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <Shield size={14} className="text-zinc-500" />
              <span className="text-[10px] font-bold text-zinc-400 tracking-[0.2em] uppercase">
                Zero-Retention Triage Node
              </span>
            </div>
          </div>
          {toast && (
            <div className="fixed top-4 right-4 bg-black/80 text-white px-4 py-2 rounded shadow-lg z-50">
              {toast}
            </div>
          )}
          <ActivityLog 
            entries={activeCategory === 'ALL' ? activityLog : activityLog.filter(e => e.category === activeCategory)} 
            isPolling={isPolling} 
            onSendDraft={handleSendDraft} 
            onRowClick={setSelectedEntry}
            safeMode={safeMode}
            isDeveloper={isDeveloper}
          />
        </main>
      </div>
      <AnimatePresence>
        {selectedEntry && (
          <ChatModal 
            entry={selectedEntry} 
            onClose={() => setSelectedEntry(null)} 
            onSendDraft={(chatId) => {
              if (selectedEntry && selectedEntry.draftReply) {
                handleSendDraft(selectedEntry.id, chatId, selectedEntry.draftReply);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
