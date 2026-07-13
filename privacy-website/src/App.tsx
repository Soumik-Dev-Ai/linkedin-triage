import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Shield, Download, Lock, HardDrive, LayoutTemplate, Terminal, Layers, Globe, Server } from 'lucide-react';

/* ────────────────────────────────────────────
   Permission data (preserved verbatim)
   ──────────────────────────────────────────── */
const permissions = [
  {
    id: 'storage',
    title: 'Storage',
    icon: <HardDrive className="w-5 h-5" />,
    content: "The `storage` permission is required to save the user's preferences locally, such as their chosen AI model (e.g., Gemini, Groq), the current 'Safe Mode' toggle status, and the connection status to the local dashboard. This ensures the extension remembers user settings across browsing sessions without requiring constant reconfiguration."
  },
  {
    id: 'activeTab',
    title: 'Active Tab',
    icon: <LayoutTemplate className="w-5 h-5" />,
    content: "The `activeTab` permission is required to allow the extension to interact with the currently open LinkedIn tab when the user explicitly clicks the extension icon or connection button. This allows the extension to verify the user is on LinkedIn before attempting to bridge the connection to the dashboard."
  },
  {
    id: 'scripting',
    title: 'Scripting',
    icon: <Terminal className="w-5 h-5" />,
    content: "The `scripting` permission is required to inject content scripts into LinkedIn's messaging interface. These scripts are strictly used to read incoming message content for the dashboard to analyze, and to inject the AI-generated reply drafts back into the LinkedIn message input box when the user approves them."
  },
  {
    id: 'tabs',
    title: 'Tabs',
    icon: <Layers className="w-5 h-5" />,
    content: "The `tabs` permission is required to detect if the local dashboard (localhost or hosted URL) is currently open in another tab. This allows the extension to establish a secure communication bridge between the LinkedIn tab and the Dashboard tab, enabling real-time data transfer."
  },
  {
    id: 'host',
    title: 'Host Permissions (*://*.linkedin.com/*)',
    icon: <Globe className="w-5 h-5" />,
    content: "Host permissions for LinkedIn are required because the core functionality of the extension relies on reading messages and injecting drafted replies specifically on LinkedIn. Without this host permission, the extension cannot interact with the LinkedIn messaging DOM to perform its single purpose."
  }
];

/* ────────────────────────────────────────────
   Single-purpose description (verbatim)
   ──────────────────────────────────────────── */
const SINGLE_PURPOSE_TEXT =
  "The single purpose of this extension is to act as an AI-powered triage assistant for LinkedIn messaging. It securely bridges the user's active LinkedIn session to a local dashboard, allowing users to rapidly categorize incoming messages and generate automated AI drafts, saving time and organizing communication efficiently.";

/* ────────────────────────────────────────────
   Remote code justification (verbatim)
   ──────────────────────────────────────────── */
const REMOTE_CODE_PARAGRAPHS = [
  "The extension relies on remote code by communicating with an external AI processing backend (e.g., Google Gemini, OpenAI, local server) via API endpoints.",
  "This remote code is strictly necessary because the heavy computational requirements of Large Language Models (LLMs) used for drafting context-aware replies cannot be executed locally within the browser extension's sandbox. All data sent to the remote code is processed ephemerally with zero-retention policies."
];

/* ────────────────────────────────────────────
   Roadmap steps (verbatim)
   ──────────────────────────────────────────── */
const ROADMAP_STEPS = [
  {
    phase: 'Current Phase: Zero Data Retention',
    description: 'Currently, no personal data is stored on our servers. All message analysis is processed completely in-memory and immediately discarded. Settings are strictly stored locally in your browser.'
  },
  {
    phase: 'Phase 2: Opt-In Anonymous Analytics',
    description: 'In the future, we may introduce a strictly opt-in feature to collect anonymous usage metadata (e.g., number of drafts generated). This will never include message content, sender details, or personally identifiable information.'
  },
  {
    phase: 'Phase 3: Cloud Sync (End-to-End Encrypted)',
    description: 'If cloud syncing of settings or custom AI prompts is ever introduced, it will be strictly voluntary and secured with client-side, End-to-End Encryption (E2EE), ensuring we cannot read your data.'
  }
];

/* ────────────────────────────────────────────
   ScrollTimeline — vertical timeline driven by useScroll.
   A vertical line fills as user scrolls, lighting up
   each step card (number, heading, description) in order.
   ──────────────────────────────────────────── */
function ScrollTimeline() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 60%', 'end 40%']
  });

  // Line fill height: 0 → full height of the container
  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  // Each step lights up when scrollYProgress crosses its threshold
  const step1Opacity = useTransform(scrollYProgress, [0, 0.25], [0.3, 1]);
  const step2Opacity = useTransform(scrollYProgress, [0.25, 0.6], [0.3, 1]);
  const step3Opacity = useTransform(scrollYProgress, [0.6, 1], [0.3, 1]);

  // Line glow colour: transitions from grey → purple as scroll progresses
  const lineGlow = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    ['rgba(167,139,250,0.2)', 'rgba(167,139,250,0.4)', 'rgba(167,139,250,0.6)', 'rgba(196,181,253,0.8)']
  );
  const lineColor = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    ['rgba(167,139,250,0.15)', 'rgba(167,139,250,0.4)', 'rgba(167,139,250,0.7)', 'rgba(196,181,253,1)']
  );

  const stepOpacities = [step1Opacity, step2Opacity, step3Opacity];

  return (
    <section className="max-w-4xl mx-auto px-6 my-24 text-center">
      <div className="space-y-4 mb-16">
        <h3 className="metallic-text text-3xl font-bold">Future Privacy Roadmap</h3>
        <p className="text-[#8A98A6]">
          As we evolve the extension, we remain committed to transparency. Here is our roadmap for potential future data handling.
        </p>
      </div>

      <div ref={containerRef} className="relative">

        {/* ── Vertical track ── */}
        <div className="absolute left-8 md:left-1/2 md:-translate-x-1/2 top-0 w-0.5 h-full bg-white/5 rounded-full" />

        {/* ── Animated fill line ── */}
        <motion.div
          className="absolute left-8 md:left-1/2 md:-translate-x-1/2 top-0 w-0.5 rounded-full"
          style={{
            height: lineHeight,
            backgroundColor: lineColor,
            boxShadow: lineGlow,
          }}
        />

        {/* ── Steps ── */}
        <div className="space-y-32 pt-4">
          {ROADMAP_STEPS.map((step, idx) => {
            const isOdd = idx % 2 === 0;
            return (
              <motion.div
                key={idx}
                style={{ opacity: stepOpacities[idx] }}
                className={`flex flex-col md:flex-row gap-8 items-start ${
                  isOdd ? '' : 'md:flex-row-reverse'
                }`}
              >
                {/* Dot on the timeline */}
                <div className="relative z-10 flex-shrink-0 ml-8 md:ml-0 md:absolute md:left-1/2 md:-translate-x-1/2">
                  <motion.div
                    className="w-4 h-4 rounded-full bg-[#a78bfa] shadow-[0_0_16px_rgba(167,139,250,0.6)]"
                    style={{ opacity: stepOpacities[idx] }}
                  />
                </div>

                {/* Step card */}
                <div
                  className={`glass-card glow-border p-8 md:p-10 rounded-3xl flex-1 max-w-lg ${
                    isOdd ? 'md:ml-auto md:mr-12' : 'md:mr-auto md:ml-12'
                  }`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <motion.span
                      style={{ opacity: stepOpacities[idx] }}
                      className="w-10 h-10 rounded-full bg-[#a78bfa]/15 border border-[#a78bfa]/30 flex items-center justify-center font-bold text-sm text-[#c4b5fd] shadow-[0_0_12px_rgba(167,139,250,0.2)]"
                    >
                      {idx + 1}
                    </motion.span>
                    <h4 className="metallic-text-bright text-xl font-bold">
                      {step.phase}
                    </h4>
                  </div>
                  <p className="text-[#8A98A6] text-lg leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Stagger animation variants
   ──────────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
};
const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const } }
};

/* ────────────────────────────────────────────
   ScrollingText — progressive per-character opacity driven by viewport scroll.
   Uses a single useScroll + useTransform for the whole paragraph, then
   derives per-character opacity from that shared progress value.
   ──────────────────────────────────────────── */
function ScrollingText({
  text,
  className = ''
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null!);
  const [visibility, setVisibility] = useState(0); // 0 → 1 as section scrolls into view

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const windowH = window.innerHeight;
      // Start fading in when the paragraph enters the bottom 80% of the viewport.
      // Fully revealed when it reaches 40% from the viewport top.
      // Map rect.top from [windowH*0.8 … windowH*0.4] to progress [0 … 1].
      const start = windowH * 0.8;
      const end   = windowH * 0.4;
      const raw   = (start - rect.top) / (start - end);
      const clamped = Math.max(0, Math.min(1, raw));
      setVisibility(prev => (Math.abs(prev - clamped) > 0.005 ? clamped : prev));
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const chars = useMemo(() => text.split(''), [text]);
  const total = chars.length;

  return (
    <p ref={ref} className={className}>
      {chars.map((ch, i) => {
        const position = total > 1 ? i / (total - 1) : 0;
        // Each character fades from 0.2 → 1 as visibility passes its position
        const opacity = 0.2 + 0.8 * Math.max(0, Math.min(1, (visibility - position * 0.7) / 0.4));
        return (
          <span key={i} style={{ opacity }}>
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        );
      })}
    </p>
  );
}

/* ────────────────────────────────────────────
   MAIN APP
   ──────────────────────────────────────────── */
export default function App() {

  return (
    <div className="min-h-screen flex flex-col bg-[#0C0C0C] text-[#D7E2EA]">

      {/* ────────────────────────────────────────
          NAVBAR — staggered fade-in + slide-up
          ──────────────────────────────────────── */}
      <motion.header
        className="sticky top-0 z-50 glass-card border-b-0 rounded-none bg-[#0C0C0C]/80"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div className="flex items-center gap-3" variants={itemVariants}>
            <div className="w-10 h-10 rounded-xl bg-[#a78bfa]/20 border border-[#a78bfa]/30 flex items-center justify-center text-[#c4b5fd] shadow-lg shadow-[#a78bfa]/10">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight text-[#D7E2EA]">AI Triage</h1>
              <p className="text-xs font-medium text-[#8A98A6]">Privacy & Transparency</p>
            </div>
          </motion.div>

          <motion.a
            href="https://chromewebstore.google.com/detail/YOUR_EXTENSION_ID"
            target="_blank"
            rel="noopener noreferrer"
            variants={itemVariants}
            className="flex items-center gap-2 bg-[#D7E2EA] hover:bg-[#BBCCD7] text-[#0C0C0C] px-5 py-2.5 rounded-full font-semibold text-sm transition-all shadow-lg shadow-[#D7E2EA]/10"
          >
            <Download className="w-4 h-4" />
            Install Extension
          </motion.a>
        </div>
      </motion.header>

      <main className="flex-1 w-full">

        {/* ────────────────────────────────────────
            HERO SECTION — globe background + overlay
            staggered fade-in/slide-up
            ──────────────────────────────────────── */}
        <section
          id="hero-section"
          className="relative min-h-screen flex items-center justify-center overflow-hidden"
        >
          {/* Globe background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img
              src="/globe.svg"
              alt=""
              className="w-[600px] h-[600px] opacity-40 animate-[spin_60s_linear_infinite]"
            />
          </div>

          {/* Radial overlay */}
          <div className="absolute inset-0 hero-overlay pointer-events-none" />

          {/* Content */}
          <motion.div
            className="relative z-10 text-center max-w-3xl mx-auto px-6 space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Badge */}
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#a78bfa]/10 text-[#c4b5fd] font-medium text-sm border border-[#a78bfa]/20"
            >
              <Lock className="w-4 h-4" />
              Zero-Retention Architecture
            </motion.div>

            {/* Heading with metallic gradient */}
            <motion.h2
              variants={itemVariants}
              className="metallic-text text-5xl md:text-6xl font-bold leading-tight tracking-tight"
            >
              Built for productivity. <br />
              <span className="metallic-text-bright">Engineered for privacy.</span>
            </motion.h2>

            {/* Description */}
            <motion.p
              variants={itemVariants}
              className="text-lg text-[#8A98A6] leading-relaxed"
            >
              AI Triage is a professional assistant designed to help you categorize and draft responses for incoming communications. We believe that your data is yours alone, which is why we've designed this extension with strict zero-retention policies and absolute transparency.
            </motion.p>

            {/* CTA */}
            <motion.div variants={itemVariants} className="pt-4">
              <a
                href="https://chromewebstore.google.com/detail/YOUR_EXTENSION_ID"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#a78bfa] hover:bg-[#c4b5fd] text-[#0C0C0C] px-8 py-4 rounded-full font-bold text-base transition-all shadow-xl shadow-[#a78bfa]/20"
              >
                <Download className="w-5 h-5" />
                Install Extension
              </a>
            </motion.div>
          </motion.div>

          {/* Scroll-down indicator */}
          <motion.div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#8A98A6]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
          >
            <span className="text-[10px] tracking-[0.3em] uppercase">Scroll</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              className="w-4 h-4 border-r border-b border-[#8A98A6]/40 rotate-45"
            />
          </motion.div>
        </section>

        {/* ────────────────────────────────────────
            SINGLE PURPOSE — scroll-driven per-char opacity
            ──────────────────────────────────────── */}
        <section
          id="about-section"
          className="glass-card mx-auto max-w-6xl p-10 md:p-14 my-24 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#a78bfa]/5 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none" />
          <div className="relative z-10 max-w-4xl">
            <h3 className="metallic-text text-3xl font-bold mb-6 flex items-center gap-3">
              Single Purpose Description
            </h3>
            <ScrollingText
              text={SINGLE_PURPOSE_TEXT}
              className="text-[#8A98A6] text-lg leading-relaxed"
            />
          </div>
        </section>

        {/* ────────────────────────────────────────
            PERMISSION JUSTIFICATIONS — Sticky Stacking Cards
            ──────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 my-24">
          <div className="mb-16 text-center max-w-2xl mx-auto space-y-4">
            <h3 className="metallic-text text-3xl font-bold">Permission Justifications</h3>
            <p className="text-[#8A98A6]">
              We only request the permissions strictly necessary to deliver the core triage functionality. Here is exactly why we need each one.
            </p>
          </div>

          {/* Sticky stacking wrapper — each card has incrementing sticky top */}
          <div className="relative">
            {permissions.map((p, idx) => {
              const topOffset = 20 + idx * 40; // progressive overlap
              const scale = 1 - idx * 0.02;    // slight scale-down per card

              return (
                <div
                  key={p.id}
                  className="sticky"
                  style={{
                    top: `${topOffset}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    zIndex: permissions.length - idx
                  }}
                >
                  <div className="glass-card glow-border p-10 md:p-14 mb-10 rounded-[40px] bg-[#0C0C0C]">
                    <div className="flex items-start gap-8">
                      <div className="p-4 bg-[#a78bfa]/10 text-[#c4b5fd] rounded-xl flex-shrink-0">
                        {p.icon}
                      </div>
                      <div className="space-y-4">
                        <h4 className="metallic-text-bright text-2xl font-bold">
                          {p.title}
                        </h4>
                        <p className="text-[#8A98A6] text-lg leading-relaxed">
                          {p.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ────────────────────────────────────────
            REMOTE CODE JUSTIFICATION — Dark aesthetic, professional typography
            ──────────────────────────────────────── */}
        <section className="glass-card glow-border mx-auto max-w-6xl p-10 md:p-14 my-24">
          <div className="flex flex-col md:flex-row gap-10 items-start">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 text-[#a78bfa] font-semibold tracking-wide uppercase text-sm">
                <Server className="w-4 h-4" />
                Architecture
              </div>
              <h3 className="metallic-text text-3xl font-bold">Remote Code Justification</h3>
              {REMOTE_CODE_PARAGRAPHS.map((para, i) => (
                <p key={i} className="text-[#8A98A6] text-lg leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────
            FUTURE PRIVACY ROADMAP — Vertical scroll-driven timeline
            ──────────────────────────────────────── */}
        <ScrollTimeline />

      </main>

      {/* ────────────────────────────────────────
          FOOTER — dark theme
          ──────────────────────────────────────── */}
      <footer className="bg-[#1A1A1A] border-t border-white/5 text-[#8A98A6] py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#c4b5fd]" />
            <span className="font-bold text-[#D7E2EA] tracking-tight">AI Triage Privacy</span>
          </div>
          <div className="text-sm">
            &copy; {new Date().getFullYear()} AI Triage. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}