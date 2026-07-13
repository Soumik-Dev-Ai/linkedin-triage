'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldOff,
  Radio,
  Loader2,
  Zap,
  Clock,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  Terminal as TerminalIcon,
} from 'lucide-react';
import type { ActivityEntry } from '@/lib/types';

interface SidebarProps {
  accountId: string | null;
  isPolling: boolean;
  activityLog: ActivityEntry[];
  onKillSession: () => void;
  isKilling: boolean;
  lastPollTime: string | null;
  errorMessage: string | null;
  terminalLogs?: string[];
  onCheckAgain?: () => void;
  activeCategory?: string;
  setActiveCategory?: (category: string) => void;
  isDeveloper?: boolean;
  onDevLoginClick?: () => void;
}

export default function Sidebar({
  accountId,
  isPolling,
  activityLog,
  onKillSession,
  isKilling,
  lastPollTime,
  errorMessage,
  terminalLogs = [],
  onCheckAgain,
  activeCategory = 'ALL',
  setActiveCategory,
  isDeveloper = false,
  onDevLoginClick,
}: SidebarProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const importantCount = activityLog.filter((e) => e.category === 'IMPORTANT').length;
  const candidateCount = activityLog.filter((e) => e.category === 'CANDIDATE').length;
  const salesCount = activityLog.filter((e) => e.category === 'SALES').length;
  const irrelevantCount = activityLog.filter((e) => e.category === 'IRRELEVANT').length;

  const handleKillClick = () => {
    if (showConfirm) {
      onKillSession();
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setShowConfirm(false), 5000);
    }
  };

  const handleExportData = async () => {
    // Generate JSONL for LLM fine tuning (chat completion format)
    const jsonlLines = activityLog.map(entry => {
      // Create a prompt that matches our backend process-loop format
      const sysPrompt = "You are a highly efficient personal assistant triage agent. Classify the user's incoming LinkedIn message into exactly one of four categories: IMPORTANT, CANDIDATE, SALES, or IRRELEVANT.";
      const userPrompt = `Message: "${entry.messagePreview}"\nCategory:`;
      const assistantResponse = entry.category;

      const obj = {
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
          { role: "assistant", content: assistantResponse }
        ]
      };
      return JSON.stringify(obj);
    }).join('\n');

    try {
      const res = await fetch('http://localhost:3001/api/save-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonlContent: jsonlLines })
      });
      if (res.ok) {
        alert("Training Data saved to server for Few-Shot learning!");
      } else {
        alert("Failed to save training data.");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving training data.");
    }
  };

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* ─── Logo / Title ─── */}
      <div className="glass-panel glow-border p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-600/30 to-zinc-800/30 border border-white/10 flex items-center justify-center">
            <Zap size={14} className="text-zinc-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-zinc-200">
              TRIAGE
            </h1>
            <p className="text-[10px] tracking-header text-zinc-500 mt-0.5">
              LINKEDIN MESSAGING
            </p>
          </div>
        </div>
      </div>

      {/* ─── Session Status ─── */}
      <div className="glass-panel p-4">
        <h2 className="tracking-header mb-3">SESSION STATUS</h2>

        <div className="flex items-center gap-2 mb-3">
          {accountId ? (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500/80 pulse-dot" />
              <span className="text-xs text-zinc-300">Connected</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-zinc-600" />
              <span className="text-xs text-zinc-500">Disconnected</span>
            </>
          )}
        </div>

        {accountId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Radio size={10} />
                Polling
              </span>
              <span className={isPolling ? 'text-emerald-400/80' : 'text-zinc-500'}>
                {isPolling ? 'Active' : 'Paused'}
              </span>
            </div>

            {lastPollTime && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <Clock size={10} />
                  Last Check
                </span>
                <span className="text-zinc-400 font-mono text-[10px]">
                  {lastPollTime}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <MessageSquare size={10} />
                Processed
              </span>
              <span className="text-zinc-300 font-mono">{activityLog.length}</span>
            </div>
          </motion.div>
        )}


      </div>

      {/* ─── Error Display ─── */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="glass-panel p-3 border-red-500/20"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={12} className="text-red-400/80 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-red-300/80 leading-relaxed">
                {errorMessage}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Statistics ─── */}
      {accountId && activityLog.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel p-4"
        >
          <h2 className="tracking-header mb-3">CLASSIFICATION BREAKDOWN</h2>

          <div className="space-y-2.5">
            {/* All Messages */}
            <div 
              className={`cursor-pointer group p-1.5 -mx-1.5 rounded transition-colors ${activeCategory === 'ALL' ? 'bg-white/10' : 'hover:bg-white/5'}`}
              onClick={() => setActiveCategory?.('ALL')}
            >
              <div className="flex items-center justify-between mb-1.5 px-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  <span className={`text-xs ${activeCategory === 'ALL' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-300'}`}>All Messages</span>
                </div>
                <span className={`text-xs font-mono ${activeCategory === 'ALL' ? 'text-white font-bold' : 'text-zinc-300'}`}>{activityLog.length}</span>
              </div>
            </div>

            {/* Important */}
            <div 
              className={`cursor-pointer group p-1.5 -mx-1.5 rounded transition-colors ${activeCategory === 'IMPORTANT' ? 'bg-white/10' : 'hover:bg-white/5'}`}
              onClick={() => setActiveCategory?.('IMPORTANT')}
            >
              <div className="flex items-center justify-between mb-1.5 px-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.7 0.15 30)' }} />
                  <span className={`text-xs ${activeCategory === 'IMPORTANT' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-300'}`}>Important</span>
                </div>
                <span className={`text-xs font-mono ${activeCategory === 'IMPORTANT' ? 'text-white font-bold' : 'text-zinc-300'}`}>{importantCount}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-zinc-800/50 overflow-hidden mx-1.5" style={{ width: 'calc(100% - 12px)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'oklch(0.65 0.15 30 / 0.5)' }}
                  initial={{ width: 0 }}
                  animate={{
                    width: activityLog.length > 0 ? `${(importantCount / activityLog.length) * 100}%` : '0%',
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Candidates */}
            <div 
              className={`cursor-pointer group p-1.5 -mx-1.5 rounded transition-colors ${activeCategory === 'CANDIDATE' ? 'bg-white/10' : 'hover:bg-white/5'}`}
              onClick={() => setActiveCategory?.('CANDIDATE')}
            >
              <div className="flex items-center justify-between mb-1.5 px-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.72 0.1 155)' }} />
                  <span className={`text-xs ${activeCategory === 'CANDIDATE' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-300'}`}>Candidates</span>
                </div>
                <span className={`text-xs font-mono ${activeCategory === 'CANDIDATE' ? 'text-white font-bold' : 'text-zinc-300'}`}>{candidateCount}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-zinc-800/50 overflow-hidden mx-1.5" style={{ width: 'calc(100% - 12px)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'oklch(0.65 0.1 155 / 0.5)' }}
                  initial={{ width: 0 }}
                  animate={{
                    width: activityLog.length > 0 ? `${(candidateCount / activityLog.length) * 100}%` : '0%',
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Sales */}
            <div 
              className={`cursor-pointer group p-1.5 -mx-1.5 rounded transition-colors ${activeCategory === 'SALES' ? 'bg-white/10' : 'hover:bg-white/5'}`}
              onClick={() => setActiveCategory?.('SALES')}
            >
              <div className="flex items-center justify-between mb-1.5 px-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.72 0.08 60)' }} />
                  <span className={`text-xs ${activeCategory === 'SALES' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-300'}`}>Sales</span>
                </div>
                <span className={`text-xs font-mono ${activeCategory === 'SALES' ? 'text-white font-bold' : 'text-zinc-300'}`}>{salesCount}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-zinc-800/50 overflow-hidden mx-1.5" style={{ width: 'calc(100% - 12px)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'oklch(0.65 0.08 60 / 0.5)' }}
                  initial={{ width: 0 }}
                  animate={{
                    width: activityLog.length > 0 ? `${(salesCount / activityLog.length) * 100}%` : '0%',
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Irrelevant */}
            <div 
              className={`cursor-pointer group p-1.5 -mx-1.5 rounded transition-colors ${activeCategory === 'IRRELEVANT' ? 'bg-white/10' : 'hover:bg-white/5'}`}
              onClick={() => setActiveCategory?.('IRRELEVANT')}
            >
              <div className="flex items-center justify-between mb-1.5 px-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.6 0.01 260)' }} />
                  <span className={`text-xs ${activeCategory === 'IRRELEVANT' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-300'}`}>Irrelevant</span>
                </div>
                <span className={`text-xs font-mono ${activeCategory === 'IRRELEVANT' ? 'text-white font-bold' : 'text-zinc-300'}`}>{irrelevantCount}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-zinc-800/50 overflow-hidden mx-1.5" style={{ width: 'calc(100% - 12px)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'oklch(0.45 0.01 260 / 0.5)' }}
                  initial={{ width: 0 }}
                  animate={{
                    width: activityLog.length > 0 ? `${(irrelevantCount / activityLog.length) * 100}%` : '0%',
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Developer Controls ─── */}
      <div className="mt-auto pt-4 flex flex-col gap-2 border-t border-white/5">
        {isDeveloper ? (
          <button
            onClick={handleExportData}
            className="w-full py-2 bg-[#c77dff]/10 hover:bg-[#c77dff]/20 border border-[#c77dff]/30 text-[#c77dff] rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <ShieldOff size={12} />
            Export Training Data
          </button>
        ) : (
          <button
            onClick={onDevLoginClick}
            className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest text-center transition-colors py-1"
          >
            Developer Login
          </button>
        )}
      </div>

      {/* ─── Danger Zone ─── */}
      {/* ─── Process Terminal ─── */}
      {accountId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel flex-1 min-h-[160px] max-h-[300px] flex flex-col p-0 overflow-hidden"
        >
          <div className="flex items-center justify-between p-3 border-b border-white/5 bg-black/20">
            <h2 className="tracking-header flex items-center gap-2 m-0">
              <TerminalIcon size={12} className="text-zinc-500" />
              PROCESS LOG
            </h2>
            {onCheckAgain && (
              <button
                onClick={onCheckAgain}
                disabled={isPolling && lastPollTime === null}
                className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw size={10} className={isPolling ? '' : ''} />
                CHECK NOW
              </button>
            )}
          </div>
          <div 
            ref={terminalScrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-1.5 text-[10px] font-mono leading-relaxed"
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: 'oklch(0.3 0 0) transparent'
            }}
          >
            {terminalLogs.map((log, i) => {
              const isError = log.includes('[Error]');
              const isWarning = log.includes('[Warning]');
              const isAction = log.includes('[Action]');
              
              let colorClass = 'text-zinc-400';
              if (isError) colorClass = 'text-red-400';
              else if (isWarning) colorClass = 'text-amber-400';
              else if (isAction) colorClass = 'text-emerald-400';

              return (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`${colorClass} break-words`}
                >
                  {log}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ─── Spacer ─── */}
      <div className="flex-1" />

      {/* ─── Kill Switch ─── */}
      {accountId && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <button
            onClick={handleKillClick}
            disabled={isKilling}
            className="kill-switch w-full py-3 px-4 rounded-lg text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isKilling ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                REVOKING ACCESS...
              </>
            ) : showConfirm ? (
              <>
                <AlertTriangle size={13} />
                CONFIRM REVOKE — CLICK AGAIN
              </>
            ) : (
              <>
                <ShieldOff size={13} />
                END SESSION · REVOKE ACCESS
              </>
            )}
          </button>

          <AnimatePresence>
            {showConfirm && !isKilling && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[10px] text-zinc-500 text-center leading-relaxed px-2"
              >
                This will stop the triage loop and clear all session data.
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ─── Footer ─── */}
      <div className="pt-2 border-t border-white/5">
        <p className="text-[9px] text-zinc-600 text-center leading-relaxed">
          ZERO-RETENTION · NO DATA STORED
          <br />
          SESSION EXPIRES ON TAB CLOSE
        </p>
      </div>
    </aside>
  );
}
