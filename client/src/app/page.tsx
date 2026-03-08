"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useLiveConnection } from "@/hooks/useLiveConnection";
import { ConversationPanel } from "@/components/ConversationPanel";
import { DocumentUpload } from "@/components/DocumentUpload";
import { ToastContainer, useToast } from "@/components/Toast";
import {
  Mic,
  MicOff,
  Camera,
  Monitor,
  X,
  Scale,
  Shield,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

// ── Clara Orb ─────────────────────────────────────────────────────────────────

type OrbState = "idle" | "connecting" | "listening" | "speaking";

const ClaraOrb = ({ state }: { state: OrbState }) => {
  const isSpeaking = state === "speaking";
  const isListening = state === "listening";
  const isConnecting = state === "connecting";
  const isActive = isSpeaking || isListening;

  const accent = isSpeaking ? "#10b981" : isListening ? "#60a5fa" : "#10b981";
  const coreGradient = isSpeaking
    ? "radial-gradient(circle at 35% 30%, #6ee7b7, #10b981, #059669, #064e35)"
    : isListening
    ? "radial-gradient(circle at 35% 30%, #93c5fd, #3b82f6, #1d4ed8, #1e3a5f)"
    : "radial-gradient(circle at 35% 30%, #34d399, #059669, #065f46, #022c22)";
  const glowColor = isSpeaking
    ? "0 0 40px #10b98155, 0 0 80px #10b98122, inset 0 1px 0 rgba(255,255,255,0.15)"
    : isListening
    ? "0 0 40px #3b82f655, 0 0 80px #3b82f622, inset 0 1px 0 rgba(255,255,255,0.1)"
    : "0 0 20px #10b98122, inset 0 1px 0 rgba(255,255,255,0.08)";

  const stateLabel = isConnecting
    ? "Connecting…"
    : isSpeaking
    ? "Speaking"
    : isListening
    ? "Listening to you"
    : "Ready";

  return (
    <div className="flex flex-col items-center justify-center gap-5 select-none">
      <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>

        {/* Outermost ring — only when active */}
        {isActive && (
          <div
            className="absolute inset-0 rounded-full orb-ring-slow"
            style={{ border: `1px solid ${accent}25` }}
          />
        )}

        {/* Expanding ring 1 */}
        {isActive && (
          <div
            className="absolute rounded-full orb-ring"
            style={{ inset: 16, border: `1px solid ${accent}50` }}
          />
        )}

        {/* Expanding ring 2 — delayed */}
        {isActive && (
          <div
            className="absolute rounded-full orb-ring-delay"
            style={{ inset: 16, border: `1px solid ${accent}35` }}
          />
        )}

        {/* Halo glow */}
        <div
          className="absolute rounded-full orb-halo"
          style={{
            inset: 28,
            background: `radial-gradient(circle, ${accent}30 0%, transparent 70%)`,
            filter: "blur(10px)",
          }}
        />

        {/* Connecting spinner ring */}
        {isConnecting && (
          <div
            className="absolute rounded-full orb-connect"
            style={{
              inset: 20,
              borderTop: `2px solid ${accent}`,
              borderRight: `2px solid transparent`,
              borderBottom: `2px solid transparent`,
              borderLeft: `2px solid transparent`,
            }}
          />
        )}

        {/* Core sphere */}
        <div
          className={`rounded-full relative overflow-hidden flex items-center justify-center ${isSpeaking ? "orb-speak" : "orb-breathe"}`}
          style={{
            width: 88,
            height: 88,
            background: coreGradient,
            boxShadow: glowColor,
          }}
        >
          {/* Inner specular highlight */}
          <div
            className="absolute rounded-full bg-white/25"
            style={{ width: 28, height: 28, top: 12, left: 16, filter: "blur(5px)" }}
          />
          <Scale className="w-8 h-8 text-white/90 relative z-10" />
        </div>
      </div>

      {/* State label */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-semibold text-white">Clara</span>
        <span
          className="text-xs font-medium transition-colors duration-300"
          style={{ color: isActive ? accent : "#475569" }}
        >
          {stateLabel}
        </span>
      </div>
    </div>
  );
};

// ── Waveform Bars ─────────────────────────────────────────────────────────────

// Bar height shape: varies per position for a natural waveform look
const BAR_SHAPE = [0.45, 0.7, 1.0, 0.7, 0.45, 0.6, 0.35];

const WaveformBars = ({
  active,
  color = "#10b981",
  height = 20,
  bars = 5,
  level, // 0–1: when provided, drives bar heights from actual mic energy
}: {
  active: boolean;
  color?: string;
  height?: number;
  bars?: number;
  level?: number;
}) => (
  <div className="flex items-end gap-0.5" style={{ height }}>
    {Array.from({ length: bars }).map((_, i) => {
      const shape = BAR_SHAPE[i % BAR_SHAPE.length];
      const barH = level !== undefined && active && level > 0
        ? Math.max(height * 0.12, height * level * shape)
        : active
        ? height * shape
        : height * 0.18;
      return (
        <div
          key={i}
          className={active && level === undefined ? "wave-bar" : ""}
          style={{
            width: 3,
            height: barH,
            borderRadius: 2,
            background: color,
            opacity: active ? 1 : 0.3,
            transformOrigin: "bottom",
            transition: level !== undefined ? "height 0.06s ease" : "height 0.2s ease",
          }}
        />
      );
    })}
  </div>
);

// Live mic level meter with threshold indicator
const MicLevelMeter = ({
  level,
  isUserSpeaking,
}: {
  level: number;        // 0–1 normalized energy
  isUserSpeaking: boolean;
}) => {
  const pct = Math.min(100, level * 100);
  const barColor = isUserSpeaking ? "#3b82f6" : "#334155";
  // Threshold sits at ~1% of normalized range (0.00125 / 0.12 ≈ 1%)
  const thresholdPct = 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>
          Mic input
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: isUserSpeaking ? "#60a5fa" : "#334155", transition: "color 0.2s" }}>
          {isUserSpeaking ? "● Speaking" : "○ Quiet"}
        </span>
      </div>
      <div style={{ position: "relative", height: 5, borderRadius: 3, background: "#1e2d45" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 3,
            background: barColor,
            transition: "width 0.06s ease, background 0.2s ease",
          }}
        />
        {/* Threshold marker line */}
        <div
          title="VAD threshold"
          style={{
            position: "absolute",
            top: -2,
            left: `${thresholdPct}%`,
            width: 2,
            height: 9,
            borderRadius: 1,
            background: "#475569",
          }}
        />
      </div>
    </div>
  );
};

// ── Source Modal ───────────────────────────────────────────────────────────────

const SourceModal = ({
  onSelect,
  onClose,
}: {
  onSelect: (source: "camera" | "screen") => void;
  onClose: () => void;
}) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-modal-title"
    >
      <div
        className="border border-[#1e2d45] rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 mb-4 sm:mb-0"
        style={{ background: "rgba(15,23,36,0.92)", backdropFilter: "blur(16px)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 id="source-modal-title" className="text-base font-bold text-white">Enable video feed</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-[#161f30] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Clara sees your document in real time through camera or screen share.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => onSelect("camera")}
            className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Camera className="w-5 h-5" />
            <span>Use Camera</span>
            <ChevronRight className="w-4 h-4 ml-auto opacity-60" />
          </button>
          <button
            onClick={() => onSelect("screen")}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[#161f30] hover:bg-[#1e2d45] border border-[#1e2d45] rounded-xl font-medium transition-all"
          >
            <Monitor className="w-5 h-5 text-slate-400" />
            <span className="text-slate-300">Share Screen</span>
            <ChevronRight className="w-4 h-4 ml-auto opacity-40" />
          </button>
        </div>
        <p className="text-[11px] text-slate-600 text-center mt-4">Press Escape to cancel</p>
      </div>
    </div>
  );
};

// ── Live Badge ─────────────────────────────────────────────────────────────────

const LiveBadge = () => (
  <span className="flex items-center gap-1.5 bg-red-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
    Live
  </span>
);

// ── Onboarding Steps ───────────────────────────────────────────────────────────

const OnboardingSteps = () => (
  <div
    className="rounded-xl border border-[#1e2d45] px-4 py-3.5"
    style={{ background: "rgba(15,23,36,0.6)", backdropFilter: "blur(8px)" }}
  >
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">How it works</p>
    <ul className="space-y-2.5">
      {[
        "Upload your legal document",
        "Connect and start the session",
        "Speak — ask Clara anything",
      ].map((step, i) => (
        <li key={i} className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-xs text-slate-400">{step}</span>
        </li>
      ))}
    </ul>
  </div>
);

// ── Connected Footer ───────────────────────────────────────────────────────────

const ConnectedFooter = ({
  isConnecting,
  isAgentSpeaking,
  isUserSpeaking,
  microphoneLevel,
  onStop,
}: {
  isConnecting: boolean;
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  microphoneLevel: number;
  onStop: () => void;
}) => {
  const label = isConnecting
    ? "Connecting…"
    : isAgentSpeaking
    ? "Clara is speaking"
    : isUserSpeaking
    ? "Listening to you…"
    : "Listening — speak naturally";

  const accent = isAgentSpeaking ? "#10b981" : isUserSpeaking ? "#60a5fa" : "#475569";

  return (
    <div className="flex items-center gap-4 flex-wrap justify-center">
      <div
        className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-[#1e2d45]"
        style={{ background: "rgba(15,23,36,0.8)", backdropFilter: "blur(8px)" }}
      >
        {isConnecting ? (
          <div className="w-5 h-5 border-2 border-[#1e2d45] border-t-emerald-500 rounded-full animate-spin flex-shrink-0" />
        ) : (
          <WaveformBars
            active={isAgentSpeaking || isUserSpeaking}
            color={accent}
            height={28}
            bars={7}
            level={isUserSpeaking ? microphoneLevel : undefined}
          />
        )}
        <span className="text-sm font-medium transition-all duration-300" style={{ color: accent }}>
          {label}
        </span>
      </div>

      {/* Live mic level meter — shown when connected and not agent speaking */}
      {!isConnecting && !isAgentSpeaking && (
        <div
          className="px-4 py-2.5 rounded-xl border border-[#1e2d45] hidden sm:block"
          style={{ background: "rgba(15,23,36,0.8)", backdropFilter: "blur(8px)" }}
        >
          <MicLevelMeter level={microphoneLevel} isUserSpeaking={isUserSpeaking} />
        </div>
      )}

      <button
        onClick={onStop}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-red-300 transition-all border border-red-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        style={{ background: "rgba(127,29,29,0.3)", backdropFilter: "blur(8px)" }}
      >
        <MicOff className="w-4 h-4" />
        End session
      </button>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Home() {
  const {
    connectionState,
    eventLog,
    isUploading,
    uploadedDoc,
    isAgentSpeaking,
    isUserSpeaking,
    microphoneLevel,
    connect,
    disconnect,
    uploadDocument,
    clearDocument,
    sendTextMessage,
  } = useLiveConnection();

  const { toasts, addToast, dismiss } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [userId] = useState(() => `user_${crypto.randomUUID()}`);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [activeSource, setActiveSource] = useState<"camera" | "screen" | null>(null);

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";
  const isActive = isConnected || isConnecting;

  const orbState: OrbState = isConnecting
    ? "connecting"
    : isAgentSpeaking
    ? "speaking"
    : isUserSpeaking
    ? "listening"
    : "idle";

  const handleUpload = useCallback(async (file: File) => {
    const id = await uploadDocument(file);
    if (id) {
      addToast(`"${file.name}" ready — Clara has read it`, "success");
    } else {
      addToast("Could not process the document. Please try a different file.", "error");
    }
    return id;
  }, [uploadDocument, addToast]);

  const handleStart = (source: "camera" | "screen") => {
    setShowSourceModal(false);
    setActiveSource(source);
    if (videoRef.current && canvasRef.current) {
      connect(videoRef.current, canvasRef.current, userId, source, uploadedDoc?.documentId);
    }
  };

  const handleStop = () => {
    disconnect();
    setActiveSource(null);
    addToast("Session ended", "info");
  };


  const panelBorderColor = isAgentSpeaking
    ? "#10b981"
    : isUserSpeaking
    ? "#3b82f6"
    : "#1e2d45";

  const panelGlow = isAgentSpeaking
    ? "0 0 0 1px #10b98133, 0 0 24px #10b98115"
    : isUserSpeaking
    ? "0 0 0 1px #3b82f633, 0 0 24px #3b82f615"
    : "none";

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--background)" }}>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      {showSourceModal && <SourceModal onSelect={handleStart} onClose={() => setShowSourceModal(false)} />}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-5 h-14 border-b border-[#1e2d45] flex-shrink-0"
        style={{ background: "rgba(8,14,26,0.8)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/40">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">ClearRight</span>
            <span className="hidden sm:inline text-slate-600 text-sm ml-2">/ Know Your Rights</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium transition-colors duration-300"
              style={{ color: isAgentSpeaking ? "#10b981" : isUserSpeaking ? "#60a5fa" : "#475569" }}
            >
              <div className={`w-2 h-2 rounded-full ${isAgentSpeaking ? "bg-emerald-400 animate-pulse" : isUserSpeaking ? "bg-blue-400 animate-pulse" : "bg-slate-600"}`} />
              {isAgentSpeaking ? "Clara speaking" : isUserSpeaking ? "You speaking" : "Session live"}
            </div>
          )}
          <div
            className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 border border-[#1e2d45] px-3 py-1.5 rounded-full"
            style={{ background: "rgba(15,23,36,0.7)", backdropFilter: "blur(8px)" }}
          >
            <Shield className="w-3 h-3 text-emerald-500" />
            <span className="hidden sm:inline">Legal information · Not legal advice</span>
            <span className="sm:hidden">Not legal advice</span>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-3 p-3">

        {/* Left column */}
        <div className="flex flex-col gap-3 overflow-y-auto min-h-0 pr-0.5">

          {/* Video / Orb panel */}
          <div
            className="rounded-2xl border overflow-hidden flex-shrink-0 transition-all duration-500"
            style={{
              background: "#080e1a",
              borderColor: panelBorderColor,
              boxShadow: panelGlow,
            }}
          >
            <div className="relative" style={{ aspectRatio: "16/8" }}>
              {/* Video feed — always rendered, hidden when not active */}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                  isConnected ? "opacity-100" : "opacity-0"
                } ${activeSource === "camera" ? "-scale-x-100" : ""}`}
              />

              {/* Clara orb — shown when not connected */}
              {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ClaraOrb state={orbState} />
                </div>
              )}

              {/* Overlays on connected */}
              {isConnected && (
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <LiveBadge />
                  {isAgentSpeaking && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-700/30"
                      style={{ background: "rgba(6,78,53,0.8)", backdropFilter: "blur(8px)", color: "#6ee7b7" }}
                    >
                      <WaveformBars active color="#10b981" height={12} />
                      Clara
                    </span>
                  )}
                  {isUserSpeaking && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-blue-700/30"
                      style={{ background: "rgba(29,78,216,0.5)", backdropFilter: "blur(8px)", color: "#93c5fd" }}
                    >
                      <WaveformBars active color="#60a5fa" height={12} />
                      You
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Document upload */}
          <div
            className="rounded-2xl border border-[#1e2d45] p-4 flex-shrink-0"
            style={{ background: "rgba(15,23,36,0.7)", backdropFilter: "blur(8px)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Upload Document
            </p>
            <DocumentUpload
              onUpload={handleUpload}
              uploadedDoc={uploadedDoc}
              onClear={clearDocument}
              isUploading={isUploading}
              disabled={isActive}
            />
          </div>

          {/* Onboarding steps */}
          {!isActive && (
            <OnboardingSteps />
          )}

          {/* Legal disclaimer */}
          <div
            className="flex items-start gap-2.5 rounded-xl border border-amber-800/25 px-4 py-3 text-[12px] text-amber-400/70 leading-relaxed flex-shrink-0"
            style={{ background: "rgba(120,53,15,0.08)", backdropFilter: "blur(4px)" }}
            role="note"
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
            <span>
              ClearRight provides general legal <strong className="text-amber-400/90">information</strong>, not legal advice.
              Consult a licensed attorney or your local legal aid organization for advice specific to your situation.
            </span>
          </div>
        </div>

        {/* Right column: Conversation */}
        <div
          className="rounded-2xl border flex flex-col overflow-hidden transition-all duration-500"
          style={{
            background: "rgba(15,23,36,0.7)",
            backdropFilter: "blur(12px)",
            borderColor: panelBorderColor,
            boxShadow: panelGlow,
          }}
        >
          <div
            className="px-4 pt-4 pb-3 border-b border-[#1e2d45] flex-shrink-0 flex items-center justify-between"
            style={{ background: "rgba(8,14,26,0.4)" }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {uploadedDoc?.analysis ? uploadedDoc.analysis.doc_type : "Document Analysis"}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {uploadedDoc ? "Analysis · suggested questions" : "Upload a document to get started"}
              </p>
            </div>
            {isAgentSpeaking && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <WaveformBars active color="#10b981" height={16} bars={6} />
                <span>Speaking</span>
              </div>
            )}
          </div>
          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4">
            <ConversationPanel
              analysis={uploadedDoc?.analysis ?? null}
              docName={uploadedDoc?.name ?? null}
              isConnected={isConnected}
              isAgentSpeaking={isAgentSpeaking}
              onSendQuestion={(q) => {
                sendTextMessage(q);
              }}
            />
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="border-t border-[#1e2d45] px-5 py-3.5 flex items-center justify-center"
        style={{ background: "rgba(15,23,36,0.8)", backdropFilter: "blur(12px)" }}
      >
        {!isActive ? (
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => setShowSourceModal(true)}
              className="flex items-center gap-2.5 px-7 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl font-bold text-white transition-all shadow-lg shadow-emerald-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Mic className="w-5 h-5" />
              {uploadedDoc ? "Talk to Clara about your document" : "Talk to Clara"}
            </button>
            {!uploadedDoc && (
              <p className="text-[11px] text-slate-600">
                Tip — upload a document first for the best experience
              </p>
            )}
          </div>
        ) : (
          <ConnectedFooter
            isConnecting={isConnecting}
            isAgentSpeaking={isAgentSpeaking}
            isUserSpeaking={isUserSpeaking}
            microphoneLevel={microphoneLevel}
            onStop={handleStop}
          />
        )}
      </footer>
    </div>
  );
}
