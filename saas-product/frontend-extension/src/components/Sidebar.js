'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldOff, Radio, Loader2, Zap, Clock, MessageSquare, AlertTriangle, RefreshCw, Terminal as TerminalIcon, } from 'lucide-react';
export default function Sidebar({ accountId, isPolling, activityLog, onConnect, onKillSession, isConnecting, isKilling, lastPollTime, errorMessage, terminalLogs = [], onCheckAgain, activeCategory = 'ALL', setActiveCategory, isDeveloper = false, onDevLoginClick, }) {
    const [showConfirm, setShowConfirm] = useState(false);
    const terminalScrollRef = useRef(null);
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
        }
        else {
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
            const res = await fetch('/api/save-training', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonlContent: jsonlLines })
            });
            if (res.ok) {
                alert("Training Data saved to server for Few-Shot learning!");
            }
            else {
                alert("Failed to save training data.");
            }
        }
        catch (e) {
            console.error(e);
            alert("Error saving training data.");
        }
    };
    return (_jsxs("aside", { className: "w-72 flex-shrink-0 flex flex-col gap-4 p-4 h-full overflow-y-auto", children: [_jsx("div", { className: "glass-panel glow-border p-5", children: _jsxs("div", { className: "flex items-center gap-3 mb-1", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-600/30 to-zinc-800/30 border border-white/10 flex items-center justify-center", children: _jsx(Zap, { size: 14, className: "text-zinc-400" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-sm font-semibold tracking-wide text-zinc-200", children: "TRIAGE" }), _jsx("p", { className: "text-[10px] tracking-header text-zinc-500 mt-0.5", children: "LINKEDIN MESSAGING" })] })] }) }), _jsxs("div", { className: "glass-panel p-4", children: [_jsx("h2", { className: "tracking-header mb-3", children: "SESSION STATUS" }), _jsx("div", { className: "flex items-center gap-2 mb-3", children: accountId ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-emerald-500/80 pulse-dot" }), _jsx("span", { className: "text-xs text-zinc-300", children: "Connected" })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-zinc-600" }), _jsx("span", { className: "text-xs text-zinc-500", children: "Disconnected" })] })) }), accountId && (_jsxs(motion.div, { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-xs", children: [_jsxs("span", { className: "text-zinc-500 flex items-center gap-1.5", children: [_jsx(Radio, { size: 10 }), "Polling"] }), _jsx("span", { className: isPolling ? 'text-emerald-400/80' : 'text-zinc-500', children: isPolling ? 'Active' : 'Paused' })] }), lastPollTime && (_jsxs("div", { className: "flex items-center justify-between text-xs", children: [_jsxs("span", { className: "text-zinc-500 flex items-center gap-1.5", children: [_jsx(Clock, { size: 10 }), "Last Check"] }), _jsx("span", { className: "text-zinc-400 font-mono text-[10px]", children: lastPollTime })] })), _jsxs("div", { className: "flex items-center justify-between text-xs", children: [_jsxs("span", { className: "text-zinc-500 flex items-center gap-1.5", children: [_jsx(MessageSquare, { size: 10 }), "Processed"] }), _jsx("span", { className: "text-zinc-300 font-mono", children: activityLog.length })] })] })), !accountId && (_jsx("button", { onClick: onConnect, disabled: isConnecting, className: "connect-button w-full mt-3 py-2.5 px-4 rounded-lg text-xs font-medium tracking-wide uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed", children: isConnecting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { size: 12, className: "animate-spin" }), "CONNECTING..."] })) : (_jsxs(_Fragment, { children: [_jsx(Radio, { size: 12 }), "CONNECT ACCOUNT"] })) }))] }), _jsx(AnimatePresence, { children: errorMessage && (_jsx(motion.div, { initial: { opacity: 0, y: -8, height: 0 }, animate: { opacity: 1, y: 0, height: 'auto' }, exit: { opacity: 0, y: -8, height: 0 }, className: "glass-panel p-3 border-red-500/20", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(AlertTriangle, { size: 12, className: "text-red-400/80 mt-0.5 flex-shrink-0" }), _jsx("p", { className: "text-[11px] text-red-300/80 leading-relaxed", children: errorMessage })] }) })) }), accountId && activityLog.length > 0 && (_jsxs(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "glass-panel p-4", children: [_jsx("h2", { className: "tracking-header mb-3", children: "CLASSIFICATION BREAKDOWN" }), _jsxs("div", { className: "space-y-2.5", children: [_jsx("div", { className: `cursor-pointer group p-1.5 -mx-1.5 rounded transition-colors ${activeCategory === 'ALL' ? 'bg-white/10' : 'hover:bg-white/5'}`, onClick: () => setActiveCategory?.('ALL'), children: _jsxs("div", { className: "flex items-center justify-between mb-1.5 px-1.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-zinc-400" }), _jsx("span", { className: `text-xs ${activeCategory === 'ALL' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-300'}`, children: "All Messages" })] }), _jsx("span", { className: `text-xs font-mono ${activeCategory === 'ALL' ? 'text-white font-bold' : 'text-zinc-300'}`, children: activityLog.length })] }) }), _jsxs("div", { className: `cursor-pointer group p-1.5 -mx-1.5 rounded transition-colors ${activeCategory === 'IMPORTANT' ? 'bg-white/10' : 'hover:bg-white/5'}`, onClick: () => setActiveCategory?.('IMPORTANT'), children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5 px-1.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full", style: { background: 'oklch(0.7 0.15 30)' } }), _jsx("span", { className: `text-xs ${activeCategory === 'IMPORTANT' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-300'}`, children: "Important" })] }), _jsx("span", { className: `text-xs font-mono ${activeCategory === 'IMPORTANT' ? 'text-white font-bold' : 'text-zinc-300'}`, children: importantCount })] }), _jsx("div", { className: "w-full h-1 rounded-full bg-zinc-800/50 overflow-hidden mx-1.5", style: { width: 'calc(100% - 12px)' }, children: _jsx(motion.div, { className: "h-full rounded-full", style: { background: 'oklch(0.65 0.15 30 / 0.5)' }, initial: { width: 0 }, animate: {
                                                width: activityLog.length > 0 ? `${(importantCount / activityLog.length) * 100}%` : '0%',
                                            }, transition: { duration: 0.6, ease: 'easeOut' } }) })] }), _jsxs("div", { className: `cursor-pointer group p-1.5 -mx-1.5 rounded transition-colors ${activeCategory === 'CANDIDATE' ? 'bg-white/10' : 'hover:bg-white/5'}`, onClick: () => setActiveCategory?.('CANDIDATE'), children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5 px-1.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full", style: { background: 'oklch(0.72 0.1 155)' } }), _jsx("span", { className: `text-xs ${activeCategory === 'CANDIDATE' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-300'}`, children: "Candidates" })] }), _jsx("span", { className: `text-xs font-mono ${activeCategory === 'CANDIDATE' ? 'text-white font-bold' : 'text-zinc-300'}`, children: candidateCount })] }), _jsx("div", { className: "w-full h-1 rounded-full bg-zinc-800/50 overflow-hidden mx-1.5", style: { width: 'calc(100% - 12px)' }, children: _jsx(motion.div, { className: "h-full rounded-full", style: { background: 'oklch(0.65 0.1 155 / 0.5)' }, initial: { width: 0 }, animate: {
                                                width: activityLog.length > 0 ? `${(candidateCount / activityLog.length) * 100}%` : '0%',
                                            }, transition: { duration: 0.6, ease: 'easeOut' } }) })] }), _jsxs("div", { className: `cursor-pointer group p-1.5 -mx-1.5 rounded transition-colors ${activeCategory === 'SALES' ? 'bg-white/10' : 'hover:bg-white/5'}`, onClick: () => setActiveCategory?.('SALES'), children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5 px-1.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full", style: { background: 'oklch(0.72 0.08 60)' } }), _jsx("span", { className: `text-xs ${activeCategory === 'SALES' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-300'}`, children: "Sales" })] }), _jsx("span", { className: `text-xs font-mono ${activeCategory === 'SALES' ? 'text-white font-bold' : 'text-zinc-300'}`, children: salesCount })] }), _jsx("div", { className: "w-full h-1 rounded-full bg-zinc-800/50 overflow-hidden mx-1.5", style: { width: 'calc(100% - 12px)' }, children: _jsx(motion.div, { className: "h-full rounded-full", style: { background: 'oklch(0.65 0.08 60 / 0.5)' }, initial: { width: 0 }, animate: {
                                                width: activityLog.length > 0 ? `${(salesCount / activityLog.length) * 100}%` : '0%',
                                            }, transition: { duration: 0.6, ease: 'easeOut' } }) })] }), _jsxs("div", { className: `cursor-pointer group p-1.5 -mx-1.5 rounded transition-colors ${activeCategory === 'IRRELEVANT' ? 'bg-white/10' : 'hover:bg-white/5'}`, onClick: () => setActiveCategory?.('IRRELEVANT'), children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5 px-1.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full", style: { background: 'oklch(0.6 0.01 260)' } }), _jsx("span", { className: `text-xs ${activeCategory === 'IRRELEVANT' ? 'text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-300'}`, children: "Irrelevant" })] }), _jsx("span", { className: `text-xs font-mono ${activeCategory === 'IRRELEVANT' ? 'text-white font-bold' : 'text-zinc-300'}`, children: irrelevantCount })] }), _jsx("div", { className: "w-full h-1 rounded-full bg-zinc-800/50 overflow-hidden mx-1.5", style: { width: 'calc(100% - 12px)' }, children: _jsx(motion.div, { className: "h-full rounded-full", style: { background: 'oklch(0.45 0.01 260 / 0.5)' }, initial: { width: 0 }, animate: {
                                                width: activityLog.length > 0 ? `${(irrelevantCount / activityLog.length) * 100}%` : '0%',
                                            }, transition: { duration: 0.6, ease: 'easeOut' } }) })] })] })] })), _jsx("div", { className: "mt-auto pt-4 flex flex-col gap-2 border-t border-white/5", children: isDeveloper ? (_jsxs("button", { onClick: handleExportData, className: "w-full py-2 bg-[#c77dff]/10 hover:bg-[#c77dff]/20 border border-[#c77dff]/30 text-[#c77dff] rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2", children: [_jsx(ShieldOff, { size: 12 }), "Export Training Data"] })) : (_jsx("button", { onClick: onDevLoginClick, className: "text-[9px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest text-center transition-colors py-1", children: "Developer Login" })) }), accountId && (_jsxs(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "glass-panel flex-1 min-h-[160px] max-h-[300px] flex flex-col p-0 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-3 border-b border-white/5 bg-black/20", children: [_jsxs("h2", { className: "tracking-header flex items-center gap-2 m-0", children: [_jsx(TerminalIcon, { size: 12, className: "text-zinc-500" }), "PROCESS LOG"] }), onCheckAgain && (_jsxs("button", { onClick: onCheckAgain, disabled: isPolling && lastPollTime === null, className: "text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors disabled:opacity-50", children: [_jsx(RefreshCw, { size: 10, className: isPolling ? '' : '' }), "CHECK NOW"] }))] }), _jsx("div", { ref: terminalScrollRef, className: "flex-1 overflow-y-auto p-3 space-y-1.5 text-[10px] font-mono leading-relaxed", style: {
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'oklch(0.3 0 0) transparent'
                        }, children: terminalLogs.map((log, i) => {
                            const isError = log.includes('[Error]');
                            const isWarning = log.includes('[Warning]');
                            const isAction = log.includes('[Action]');
                            let colorClass = 'text-zinc-400';
                            if (isError)
                                colorClass = 'text-red-400';
                            else if (isWarning)
                                colorClass = 'text-amber-400';
                            else if (isAction)
                                colorClass = 'text-emerald-400';
                            return (_jsx(motion.div, { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 }, className: `${colorClass} break-words`, children: log }, i));
                        }) })] })), _jsx("div", { className: "flex-1" }), accountId && (_jsxs(motion.div, { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, className: "space-y-2", children: [_jsx("button", { onClick: handleKillClick, disabled: isKilling, className: "kill-switch w-full py-3 px-4 rounded-lg text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed", children: isKilling ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { size: 13, className: "animate-spin" }), "REVOKING ACCESS..."] })) : showConfirm ? (_jsxs(_Fragment, { children: [_jsx(AlertTriangle, { size: 13 }), "CONFIRM REVOKE \u2014 CLICK AGAIN"] })) : (_jsxs(_Fragment, { children: [_jsx(ShieldOff, { size: 13 }), "END SESSION \u00B7 REVOKE ACCESS"] })) }), _jsx(AnimatePresence, { children: showConfirm && !isKilling && (_jsx(motion.p, { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, className: "text-[10px] text-zinc-500 text-center leading-relaxed px-2", children: "This will permanently delete the connected account from Unipile and flush all session data." })) })] })), _jsx("div", { className: "pt-2 border-t border-white/5", children: _jsxs("p", { className: "text-[9px] text-zinc-600 text-center leading-relaxed", children: ["ZERO-RETENTION \u00B7 NO DATA STORED", _jsx("br", {}), "SESSION EXPIRES ON TAB CLOSE"] }) })] }));
}
