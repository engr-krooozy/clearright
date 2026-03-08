import React from "react";
import { Bot, FileText, Scale, MessageSquare } from "lucide-react";

type EventPart = {
  type: "text" | "audio/pcm" | "function_call" | "function_response";
  data: any;
};

export type StructuredAgentEvent = {
  id: string;
  author: string;
  is_partial: boolean;
  turn_complete: boolean;
  parts: EventPart[];
  input_transcription?: { text: string; is_final: boolean } | null;
  output_transcription?: { text: string; is_final: boolean } | null;
  interrupted?: boolean | null;
};

export type DocAnalysis = {
  doc_type: string;
  risk_level: "high" | "medium" | "low";
  key_points: string[];
  suggested_questions: string[];
};


const ThinkingDots = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 4px" }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{
        width: 6, height: 6, borderRadius: "50%", background: "#10b981",
        animationDelay: `${i * 150}ms`, animationDuration: "0.8s",
      }} className="animate-bounce" />
    ))}
  </div>
);


// ── Risk badge ────────────────────────────────────────────────────────────────

const RISK_COLORS = {
  high: { bg: "rgba(127,29,29,0.25)", border: "rgba(239,68,68,0.3)", text: "#f87171" },
  medium: { bg: "rgba(120,53,15,0.25)", border: "rgba(245,158,11,0.3)", text: "#fbbf24" },
  low: { bg: "rgba(6,78,53,0.25)", border: "rgba(16,185,129,0.3)", text: "#34d399" },
};

// ── Document Analysis Card ────────────────────────────────────────────────────

const DocumentAnalysisCard = ({ analysis, docName }: { analysis: DocAnalysis; docName: string }) => {
  const risk = RISK_COLORS[analysis.risk_level] ?? RISK_COLORS.medium;
  return (
    <div style={{
      borderRadius: 14,
      border: "1px solid rgba(30,45,69,0.9)",
      background: "rgba(15,23,36,0.7)",
      overflow: "hidden",
    }}>
      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 8px",
        borderBottom: "1px solid rgba(30,45,69,0.6)",
        background: "rgba(8,14,26,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #064e35, #10b981)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileText style={{ width: 13, height: 13, color: "#fff" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>{analysis.doc_type}</p>
            <p style={{ fontSize: 10, color: "rgba(100,116,139,0.7)", margin: 0, marginTop: 1 }}
              title={docName}
            >
              {docName.length > 32 ? docName.slice(0, 30) + "…" : docName}
            </p>
          </div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          padding: "3px 8px", borderRadius: 6,
          background: risk.bg, border: `1px solid ${risk.border}`, color: risk.text,
        }}>
          {analysis.risk_level} risk
        </div>
      </div>
      {/* Key points */}
      <div style={{ padding: "10px 14px" }}>
        {analysis.key_points.map((point, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < analysis.key_points.length - 1 ? 7 : 0 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#10b981", flexShrink: 0, marginTop: 6 }} />
            <p style={{ fontSize: 12, color: "rgba(203,213,225,0.8)", lineHeight: 1.55, margin: 0 }}>{point}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Suggested Questions ───────────────────────────────────────────────────────

const SuggestedQuestions = ({
  questions,
  onSend,
  isConnected,
}: {
  questions: string[];
  onSend: (q: string) => void;
  isConnected: boolean;
}) => (
  <div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <MessageSquare style={{ width: 11, height: 11, color: "rgba(100,116,139,0.6)" }} />
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(100,116,139,0.6)", margin: 0 }}>
        {isConnected ? "Tap to ask Clara" : "Questions to ask"}
      </p>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => isConnected && onSend(q)}
          disabled={!isConnected}
          style={{
            textAlign: "left",
            padding: "9px 12px",
            borderRadius: 10,
            border: isConnected ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(30,45,69,0.6)",
            background: isConnected ? "rgba(6,78,53,0.12)" : "rgba(15,23,36,0.4)",
            color: isConnected ? "#cbd5e1" : "rgba(100,116,139,0.6)",
            fontSize: 12,
            lineHeight: 1.5,
            cursor: isConnected ? "pointer" : "default",
            transition: "all 0.15s ease",
            width: "100%",
          }}
          onMouseEnter={e => {
            if (isConnected) {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(6,78,53,0.22)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.35)";
            }
          }}
          onMouseLeave={e => {
            if (isConnected) {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(6,78,53,0.12)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.2)";
            }
          }}
        >
          {q}
        </button>
      ))}
    </div>
    {!isConnected && (
      <p style={{ fontSize: 10, color: "rgba(71,85,105,0.7)", marginTop: 8, textAlign: "center" }}>
        Start a session to ask these questions
      </p>
    )}
  </div>
);

// ── Default question chips (no document) ─────────────────────────────────────

const DEFAULT_QUESTIONS = [
  "What are my rights in this situation?",
  "Is this enforceable under the law?",
  "What should I be aware of before signing?",
  "Can I negotiate any of these terms?",
];

// ── No-document idle state ────────────────────────────────────────────────────

const NoDocumentState = ({ isConnected, onSend }: { isConnected: boolean; onSend: (q: string) => void }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0 8px", textAlign: "center" }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: "rgba(15,23,36,0.6)", border: "1px solid rgba(30,45,69,0.8)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Scale style={{ width: 18, height: 18, color: "rgba(100,116,139,0.5)" }} />
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(100,116,139,0.8)", margin: "0 0 3px" }}>No document uploaded</p>
        <p style={{ fontSize: 11, color: "rgba(71,85,105,0.7)", margin: 0 }}>Upload a document for a personalised analysis</p>
      </div>
    </div>
    <SuggestedQuestions questions={DEFAULT_QUESTIONS} onSend={onSend} isConnected={isConnected} />
  </div>
);

// ── Main export ───────────────────────────────────────────────────────────────

export const ConversationPanel = ({
  analysis,
  docName,
  isConnected,
  isAgentSpeaking,
  onSendQuestion,
}: {
  analysis: DocAnalysis | null;
  docName: string | null;
  isConnected: boolean;
  isAgentSpeaking?: boolean;
  onSendQuestion: (q: string) => void;
}) => {
  if (!analysis) {
    return <NoDocumentState isConnected={isConnected} onSend={onSendQuestion} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <DocumentAnalysisCard analysis={analysis} docName={docName ?? "Document"} />
      <SuggestedQuestions
        questions={analysis.suggested_questions}
        onSend={onSendQuestion}
        isConnected={isConnected}
      />
      {isAgentSpeaking && (
        <div className="message-enter" style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(16,185,129,0.15)",
          background: "rgba(15,23,36,0.5)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #065f46, #10b981)",
              border: "1px solid rgba(16,185,129,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot style={{ width: 11, height: 11, color: "#fff" }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(16,185,129,0.7)" }}>
              Clara
            </span>
          </div>
          <ThinkingDots />
        </div>
      )}
    </div>
  );
};
