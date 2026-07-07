'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Briefcase,
  Mail,
  Clock,
  ArrowRight,
  Inbox,
} from 'lucide-react';
import type { ActivityEntry } from '@/lib/types';
import { CATEGORY_CONFIG } from '@/lib/types';

interface ActivityLogProps {
  entries: ActivityEntry[];
  isPolling: boolean;
  onSendDraft?: (id: string, chatId: string, draftReply: string) => void;
  onRowClick?: (entry: ActivityEntry) => void;
  safeMode?: boolean;
  isDeveloper?: boolean;
  onCategoryChange?: (id: string, newCategory: string) => void;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'CANDIDATE':
      return <User size={11} />;
    case 'SALES':
      return <Briefcase size={11} />;
    case 'IRRELEVANT':
      return <Mail size={11} />;
    default:
      return <Mail size={11} />;
  }
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

export default function ActivityLog({ entries, isPolling, onSendDraft, onRowClick, safeMode = false, isDeveloper = false, onCategoryChange }: ActivityLogProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = () => setOpenDropdownId(null);
    if (openDropdownId) {
      window.addEventListener('click', handleClick);
    }
    return () => window.removeEventListener('click', handleClick);
  }, [openDropdownId]);

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const unreadEntries = safeMode ? sortedEntries.filter(e => !e.sent) : [];
  const sentEntries = safeMode ? sortedEntries.filter(e => e.sent) : [];

  const renderRow = (entry: ActivityEntry, index: number) => {
    const config = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.IRRELEVANT;
    return (
      <motion.div
        key={entry.id}
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
          delay: index * 0.05,
        }}
        className="log-row animate-in grid grid-cols-[1fr_120px_1.5fr_90px] gap-4 px-5 py-4 border-b border-white/[0.04] items-center relative group cursor-pointer hover:bg-white/[0.02] transition-colors"
        style={{ animationDelay: `${index * 0.05}s` }}
        onClick={() => onRowClick?.(entry)}
      >
        {/* Hover Glow Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#9d4edd]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        
        {/* Sender */}
        <div className="flex items-center gap-3 min-w-0 z-10">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-inner transition-transform group-hover:scale-110 duration-300"
            style={{ background: `${config.color}15`, borderColor: `${config.color}30` }}
          >
            <span
              className="text-xs font-black uppercase tracking-wider"
              style={{ color: config.color, textShadow: `0 0 8px ${config.color}80` }}
            >
              {entry.senderName.charAt(0)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] text-zinc-200 font-bold truncate tracking-wide">
              {entry.senderName}
            </p>
            <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-medium">
              {truncate(entry.messagePreview, 40)}
            </p>
          </div>
        </div>

        {/* Category Badge */}
        <div className="z-10 relative">
          <button
            className={`badge ${config.className} ${isDeveloper ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
            onClick={(e) => {
              if (isDeveloper) {
                e.stopPropagation();
                setOpenDropdownId(openDropdownId === entry.id ? null : entry.id);
              }
            }}
          >
            {getCategoryIcon(entry.category)}
            {config.label}
          </button>
          
          {isDeveloper && (
            <AnimatePresence>
              {openDropdownId === entry.id && (
                <motion.div
                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-36 glass-panel glow-border p-1 z-50 shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {Object.entries(CATEGORY_CONFIG).map(([cat, catConfig]) => (
                    <button
                      key={cat}
                      className="w-full text-left px-3 py-2 text-[10px] font-bold tracking-wider rounded transition-all flex items-center gap-2 hover:bg-white/10"
                      style={{ color: catConfig.color }}
                      onClick={() => {
                        onCategoryChange?.(entry.id, cat);
                        setOpenDropdownId(null);
                      }}
                    >
                      {getCategoryIcon(cat)}
                      {catConfig.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Action */}
        <div className="flex items-center gap-2.5 min-w-0 z-10">
          <ArrowRight size={12} className="text-[#9d4edd] flex-shrink-0" />
          <p className="text-xs text-zinc-300 truncate font-medium">
            {truncate(entry.action, 60)}
          </p>
          {entry.draftReply && !entry.sent && (
            <button
              className="ml-2 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-zinc-200 rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onSendDraft?.(entry.id, entry.chatId, entry.draftReply!);
              }}
            >
              Send
            </button>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-right z-10">
          <span className="text-[11px] font-mono font-bold text-zinc-500 flex items-center justify-end gap-1.5 group-hover:text-zinc-300 transition-colors">
            <Clock size={11} className="text-zinc-500 group-hover:text-[#c77dff] transition-colors" />
            {formatTimestamp(entry.timestamp)}
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="tracking-header-lg">ACTIVITY LOG</h2>
          <p className="text-[11px] text-zinc-500 mt-1">
            Real-time classification and auto-response feed
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isPolling && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 glass-panel-subtle px-3 py-1.5"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-500/60"
              />
              <span className="text-[10px] tracking-header text-zinc-500">
                MONITORING
              </span>
            </motion.div>
          )}

          <div className="glass-panel-subtle px-3 py-1.5">
            <span className="text-[10px] tracking-header text-zinc-500">
              {entries.length} {entries.length === 1 ? 'ENTRY' : 'ENTRIES'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="glass-panel glass-panel-hover glow-border flex-1 overflow-hidden flex flex-col relative scan-line spotlight-wrapper">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_120px_1.5fr_90px] gap-4 px-5 py-3 border-b border-white/10 bg-black/20">
          <span className="tracking-header-lg">SENDER</span>
          <span className="tracking-header-lg">CATEGORY</span>
          <span className="tracking-header-lg">ACTION TAKEN</span>
          <span className="tracking-header-lg text-right">TIME</span>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {sortedEntries.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full py-20 gap-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                  <Inbox size={26} className="text-[#9d4edd]" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-zinc-300 font-bold tracking-wide">
                    No messages processed yet
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1.5 max-w-[200px] leading-relaxed mx-auto">
                    {isPolling
                      ? 'Monitoring inbox for unread messages…'
                      : 'Connect your account to begin triage'}
                  </p>
                </div>
              </motion.div>
            ) : safeMode ? (
              <>
                {unreadEntries.length > 0 && (
                  <motion.div layout key="header-unread" className="px-5 py-2.5 bg-black/40 border-b border-white/5 text-[10px] font-bold tracking-widest text-zinc-500 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/80 animate-pulse" />
                    UNREAD MESSAGES
                  </motion.div>
                )}
                {unreadEntries.map((e, i) => renderRow(e, i))}
                
                {sentEntries.length > 0 && (
                  <motion.div layout key="header-sent" className="px-5 py-2.5 bg-black/40 border-b border-white/5 border-t border-t-white/10 text-[10px] font-bold tracking-widest text-zinc-500 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                    SENT MESSAGES
                  </motion.div>
                )}
                {sentEntries.map((e, i) => renderRow(e, i + unreadEntries.length))}
              </>
            ) : (
              sortedEntries.map((entry, index) => renderRow(entry, index))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
