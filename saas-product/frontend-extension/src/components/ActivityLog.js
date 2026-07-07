'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Briefcase, Mail, Clock, ArrowRight, Inbox, } from 'lucide-react';
import { CATEGORY_CONFIG } from '@/lib/types';
function getCategoryIcon(category) {
    switch (category) {
        case 'CANDIDATE':
            return _jsx(User, { size: 11 });
        case 'SALES':
            return _jsx(Briefcase, { size: 11 });
        case 'IRRELEVANT':
            return _jsx(Mail, { size: 11 });
        default:
            return _jsx(Mail, { size: 11 });
    }
}
function formatTimestamp(ts) {
    try {
        const date = new Date(ts);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    }
    catch {
        return ts;
    }
}
function truncate(str, maxLen) {
    if (str.length <= maxLen)
        return str;
    return str.slice(0, maxLen) + '…';
}
export default function ActivityLog({ entries, isPolling, onSendDraft, onRowClick, safeMode = false, isDeveloper = false, onCategoryChange }) {
    const [openDropdownId, setOpenDropdownId] = useState(null);
    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = () => setOpenDropdownId(null);
        if (openDropdownId) {
            window.addEventListener('click', handleClick);
        }
        return () => window.removeEventListener('click', handleClick);
    }, [openDropdownId]);
    const sortedEntries = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const unreadEntries = safeMode ? sortedEntries.filter(e => !e.sent) : [];
    const sentEntries = safeMode ? sortedEntries.filter(e => e.sent) : [];
    const renderRow = (entry, index) => {
        const config = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.IRRELEVANT;
        return (_jsxs(motion.div, { initial: { opacity: 0, y: -12, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, x: -20 }, transition: {
                type: 'spring',
                stiffness: 400,
                damping: 30,
                delay: index * 0.05,
            }, className: "log-row animate-in grid grid-cols-[1fr_120px_1.5fr_90px] gap-4 px-5 py-4 border-b border-white/[0.04] items-center relative group cursor-pointer hover:bg-white/[0.02] transition-colors", style: { animationDelay: `${index * 0.05}s` }, onClick: () => onRowClick?.(entry), children: [_jsx("div", { className: "absolute inset-0 bg-gradient-to-r from-transparent via-[#9d4edd]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" }), _jsxs("div", { className: "flex items-center gap-3 min-w-0 z-10", children: [_jsx("div", { className: "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-inner transition-transform group-hover:scale-110 duration-300", style: { background: `${config.color}15`, borderColor: `${config.color}30` }, children: _jsx("span", { className: "text-xs font-black uppercase tracking-wider", style: { color: config.color, textShadow: `0 0 8px ${config.color}80` }, children: entry.senderName.charAt(0) }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-[13px] text-zinc-200 font-bold truncate tracking-wide", children: entry.senderName }), _jsx("p", { className: "text-[11px] text-zinc-500 truncate mt-0.5 font-medium", children: truncate(entry.messagePreview, 40) })] })] }), _jsxs("div", { className: "z-10 relative", children: [_jsxs("button", { className: `badge ${config.className} ${isDeveloper ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`, onClick: (e) => {
                                if (isDeveloper) {
                                    e.stopPropagation();
                                    setOpenDropdownId(openDropdownId === entry.id ? null : entry.id);
                                }
                            }, children: [getCategoryIcon(entry.category), config.label] }), isDeveloper && (_jsx(AnimatePresence, { children: openDropdownId === entry.id && (_jsx(motion.div, { initial: { opacity: 0, y: -5, scale: 0.95 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -5, scale: 0.95 }, transition: { duration: 0.15 }, className: "absolute top-full left-0 mt-2 w-36 glass-panel glow-border p-1 z-50 shadow-2xl overflow-hidden", onClick: (e) => e.stopPropagation(), children: Object.entries(CATEGORY_CONFIG).map(([cat, catConfig]) => (_jsxs("button", { className: "w-full text-left px-3 py-2 text-[10px] font-bold tracking-wider rounded transition-all flex items-center gap-2 hover:bg-white/10", style: { color: catConfig.color }, onClick: () => {
                                        onCategoryChange?.(entry.id, cat);
                                        setOpenDropdownId(null);
                                    }, children: [getCategoryIcon(cat), catConfig.label] }, cat))) })) }))] }), _jsxs("div", { className: "flex items-center gap-2.5 min-w-0 z-10", children: [_jsx(ArrowRight, { size: 12, className: "text-[#9d4edd] flex-shrink-0" }), _jsx("p", { className: "text-xs text-zinc-300 truncate font-medium", children: truncate(entry.action, 60) }), entry.draftReply && !entry.sent && (_jsx("button", { className: "ml-2 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-zinc-200 rounded transition-colors", onClick: (e) => {
                                e.stopPropagation();
                                onSendDraft?.(entry.id, entry.chatId, entry.draftReply);
                            }, children: "Send" }))] }), _jsx("div", { className: "text-right z-10", children: _jsxs("span", { className: "text-[11px] font-mono font-bold text-zinc-500 flex items-center justify-end gap-1.5 group-hover:text-zinc-300 transition-colors", children: [_jsx(Clock, { size: 11, className: "text-zinc-500 group-hover:text-[#c77dff] transition-colors" }), formatTimestamp(entry.timestamp)] }) })] }, entry.id));
    };
    return (_jsxs("div", { className: "flex-1 flex flex-col gap-4 p-4 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "tracking-header-lg", children: "ACTIVITY LOG" }), _jsx("p", { className: "text-[11px] text-zinc-500 mt-1", children: "Real-time classification and auto-response feed" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [isPolling && (_jsxs(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "flex items-center gap-2 glass-panel-subtle px-3 py-1.5", children: [_jsx(motion.div, { animate: { scale: [1, 1.3, 1] }, transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' }, className: "w-1.5 h-1.5 rounded-full bg-emerald-500/60" }), _jsx("span", { className: "text-[10px] tracking-header text-zinc-500", children: "MONITORING" })] })), _jsx("div", { className: "glass-panel-subtle px-3 py-1.5", children: _jsxs("span", { className: "text-[10px] tracking-header text-zinc-500", children: [entries.length, " ", entries.length === 1 ? 'ENTRY' : 'ENTRIES'] }) })] })] }), _jsxs("div", { className: "glass-panel glass-panel-hover glow-border flex-1 overflow-hidden flex flex-col relative scan-line spotlight-wrapper", children: [_jsxs("div", { className: "grid grid-cols-[1fr_120px_1.5fr_90px] gap-4 px-5 py-3 border-b border-white/10 bg-black/20", children: [_jsx("span", { className: "tracking-header-lg", children: "SENDER" }), _jsx("span", { className: "tracking-header-lg", children: "CATEGORY" }), _jsx("span", { className: "tracking-header-lg", children: "ACTION TAKEN" }), _jsx("span", { className: "tracking-header-lg text-right", children: "TIME" })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: _jsx(AnimatePresence, { mode: "popLayout", children: sortedEntries.length === 0 ? (_jsxs(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "flex flex-col items-center justify-center h-full py-20 gap-4", children: [_jsx("div", { className: "w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner", children: _jsx(Inbox, { size: 26, className: "text-[#9d4edd]" }) }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-sm text-zinc-300 font-bold tracking-wide", children: "No messages processed yet" }), _jsx("p", { className: "text-[11px] text-zinc-500 mt-1.5 max-w-[200px] leading-relaxed mx-auto", children: isPolling
                                                    ? 'Monitoring inbox for unread messages…'
                                                    : 'Connect your account to begin triage' })] })] })) : safeMode ? (_jsxs(_Fragment, { children: [unreadEntries.length > 0 && (_jsxs(motion.div, { layout: true, className: "px-5 py-2.5 bg-black/40 border-b border-white/5 text-[10px] font-bold tracking-widest text-zinc-500 flex items-center gap-2", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-blue-500/80 animate-pulse" }), "UNREAD MESSAGES"] }, "header-unread")), unreadEntries.map((e, i) => renderRow(e, i)), sentEntries.length > 0 && (_jsxs(motion.div, { layout: true, className: "px-5 py-2.5 bg-black/40 border-b border-white/5 border-t border-t-white/10 text-[10px] font-bold tracking-widest text-zinc-500 flex items-center gap-2", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500/80" }), "SENT MESSAGES"] }, "header-sent")), sentEntries.map((e, i) => renderRow(e, i + unreadEntries.length))] })) : (sortedEntries.map((entry, index) => renderRow(entry, index))) }) })] })] }));
}
