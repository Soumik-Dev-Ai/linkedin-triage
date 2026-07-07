'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, CheckCircle } from 'lucide-react';
import type { ActivityEntry } from '@/lib/types';
import { CATEGORY_CONFIG } from '@/lib/types';

interface ChatModalProps {
  entry: ActivityEntry | null;
  onClose: () => void;
  onSendDraft?: (chatId: string) => void;
}

export default function ChatModal({ entry, onClose, onSendDraft }: ChatModalProps) {
  if (!entry) return null;

  const config = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG['IRRELEVANT'];
  const hasHistory = entry.chatHistory && entry.chatHistory.length > 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* 3D Modal Box */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, rotateX: 20, y: 50 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, rotateX: -10, y: 20 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.6 }}
          className="relative w-full max-w-2xl bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel flex flex-col max-h-[85vh]"
          style={{ transformPerspective: 1000 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.02]">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {entry.senderName}
              </h2>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border bg-black/20 font-medium tracking-wide ${config.className}`}
                  style={{ color: config.color, borderColor: `${config.color}40` }}
                >
                  {config.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {hasHistory ? (
              entry.chatHistory!.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: msg.isMe ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[80%] flex flex-col gap-1">
                    <span className={`text-[10px] text-zinc-500 uppercase tracking-wider px-1 ${msg.isMe ? 'text-right' : 'text-left'}`}>
                      {msg.isMe ? 'Me' : entry.senderName}
                    </span>
                    <div
                      className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                        msg.isMe
                          ? 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20 rounded-tr-sm'
                          : 'bg-zinc-800/50 text-zinc-200 border border-zinc-700/50 rounded-tl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex justify-start"
              >
                <div className="max-w-[80%] flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider px-1 text-left">
                    {entry.senderName}
                  </span>
                  <div className="p-3.5 rounded-2xl text-sm leading-relaxed bg-zinc-800/50 text-zinc-200 border border-zinc-700/50 rounded-tl-sm">
                    {entry.messagePreview}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Generated AI Draft / Auto-Reply */}
            {entry.draftReply && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (entry.chatHistory?.length || 1) * 0.1 + 0.2 }}
                className="flex justify-end pt-4"
              >
                <div className="max-w-[85%] flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider px-1 flex items-center justify-end gap-1.5">
                    {entry.sent ? (
                      <>
                        <CheckCircle size={10} className="text-emerald-500" />
                        AI Sent Reply
                      </>
                    ) : (
                      <>
                        <Bot size={10} className="text-blue-400" />
                        AI Generated Draft
                      </>
                    )}
                  </span>
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed border relative overflow-hidden ${
                      entry.sent
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-50 rounded-tr-sm shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'bg-blue-500/15 border-blue-500/30 text-blue-50 rounded-tr-sm shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                    }`}
                  >
                    <div className="relative z-10">{entry.draftReply}</div>
                    
                    {/* Animated gradient sweep background */}
                    <motion.div
                      className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          {!entry.sent && entry.draftReply && (
            <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSendDraft?.(entry.chatId);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors flex items-center gap-2 group shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                <span>Send Reply</span>
                <Send size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
