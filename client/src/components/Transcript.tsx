import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Download, MessagesSquare, User, Bot, Search } from "lucide-react";
import { StructuredAgentEvent } from "./ConversationPanel";

type Order = "asc" | "desc";
type SpeakerFilter = "all" | "user" | "agent";

// ── Helpers ─────────────────────────────────────────────────────────────────

const textOf = (e: StructuredAgentEvent) =>
  e.parts.filter((p) => p.type === "text").map((p) => p.data).join("").trim();

const isTextTurn = (e: StructuredAgentEvent) => textOf(e).length > 0;

// Clara grounds answers against current law via a search tool. We surface the
// call (not the raw response) as a "checked current law" chip in the timeline.
const isGroundingCall = (e: StructuredAgentEvent) =>
  e.parts.some((p) => p.type === "function_call");

const isShown = (e: StructuredAgentEvent) => isTextTurn(e) || isGroundingCall(e);

const speakerLabel = (author: string) => (author === "user" ? "You" : "Clara");

const formatTime = (ts?: number) =>
  ts
    ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ── Export to PDF (via browser print dialog → "Save as PDF") ─────────────────

function exportToPdf(turns: StructuredAgentEvent[], docName: string | null) {
  const dateStr = new Date().toLocaleString();
  const rows = turns
    .map((e) => {
      const who = speakerLabel(e.author);
      const time = formatTime(e.timestamp);
      const accent = e.author === "user" ? "#1d4ed8" : "#059669";
      return `
        <div class="turn">
          <div class="meta"><span class="who" style="color:${accent}">${who}</span>${
        time ? `<span class="time">${time}</span>` : ""
      }</div>
          <div class="body">${escapeHtml(textOf(e))}</div>
        </div>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>ClearRight session transcript</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 40px; line-height: 1.5; }
  header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { font-size: 12px; color: #64748b; }
  .turn { margin-bottom: 16px; page-break-inside: avoid; }
  .meta { font-size: 12px; margin-bottom: 3px; }
  .who { font-weight: 700; }
  .time { color: #94a3b8; margin-left: 8px; }
  .body { font-size: 14px; white-space: pre-wrap; }
  footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <header>
    <h1>ClearRight — Session Transcript</h1>
    <div class="sub">${docName ? `Document: ${escapeHtml(docName)} · ` : ""}Generated ${dateStr}</div>
  </header>
  ${rows || '<p class="sub">No conversation was recorded in this session.</p>'}
  <footer>ClearRight provides general legal information, not legal advice. Consult a licensed attorney or local legal aid organization for advice specific to your situation.</footer>
</body>
</html>`;

  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the new document a tick to lay out before invoking print.
  setTimeout(() => win.print(), 250);
}

// ── Toolbar button ──────────────────────────────────────────────────────────

const toolbarBtn = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 9px",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s ease",
  border: `1px solid ${active ? "rgba(16,185,129,0.4)" : "rgba(30,45,69,0.8)"}`,
  background: active ? "rgba(6,78,53,0.25)" : "rgba(15,23,36,0.5)",
  color: active ? "#6ee7b7" : "#94a3b8",
});

// ── Component ─────────────────────────────────────────────────────────────────

export const Transcript = ({
  events,
  docName,
}: {
  events: StructuredAgentEvent[];
  docName: string | null;
}) => {
  const [order, setOrder] = useState<Order>("asc");
  const [filter, setFilter] = useState<SpeakerFilter>("all");
  const endRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const list = events.filter(isShown);
    const filtered =
      filter === "all"
        ? list
        : filter === "user"
        ? list.filter((e) => e.author === "user" && isTextTurn(e))
        : list.filter((e) => e.author !== "user"); // Clara's replies + grounding chips
    return order === "asc" ? filtered : [...filtered].reverse();
  }, [events, filter, order]);

  // The full chronological set (oldest-first) is what we export, regardless of
  // the current on-screen sort/filter — a transcript should be complete.
  const exportTurns = useMemo(() => events.filter(isTextTurn), [events]);

  // Auto-scroll to the newest message when in chronological (oldest-first) view.
  useEffect(() => {
    if (order === "asc") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [rows.length, order]);

  if (events.filter(isShown).length === 0) return null;

  const filterChips: { key: SpeakerFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "user", label: "You" },
    { key: "agent", label: "Clara" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          paddingTop: 12,
          borderTop: "1px solid rgba(30,45,69,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MessagesSquare style={{ width: 12, height: 12, color: "rgba(100,116,139,0.7)" }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(100,116,139,0.7)",
            }}
          >
            Transcript
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Speaker filter */}
          {filterChips.map((c) => (
            <button key={c.key} onClick={() => setFilter(c.key)} style={toolbarBtn(filter === c.key)}>
              {c.key === "user" && <User style={{ width: 11, height: 11 }} />}
              {c.key === "agent" && <Bot style={{ width: 11, height: 11 }} />}
              {c.label}
            </button>
          ))}

          {/* Chronology toggle */}
          <button
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            style={toolbarBtn(false)}
            title="Toggle order"
          >
            <ArrowDownUp style={{ width: 11, height: 11 }} />
            {order === "asc" ? "Oldest" : "Newest"}
          </button>

          {/* Export PDF */}
          <button onClick={() => exportToPdf(exportTurns, docName)} style={toolbarBtn(false)} title="Export as PDF">
            <Download style={{ width: 11, height: 11 }} />
            PDF
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((e) => {
          // Grounding chip — Clara checked current law for this turn.
          if (!isTextTurn(e)) {
            return (
              <div
                key={e.id}
                className="message-enter"
                style={{ display: "flex", justifyContent: "flex-start" }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    border: "1px solid rgba(16,185,129,0.25)",
                    background: "rgba(6,78,53,0.18)",
                    color: "rgba(110,231,183,0.9)",
                  }}
                >
                  <Search style={{ width: 11, height: 11 }} />
                  Checked current law
                </span>
              </div>
            );
          }

          const isUser = e.author === "user";
          return (
            <div
              key={e.id}
              className="message-enter"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: isUser ? "rgba(96,165,250,0.8)" : "rgba(16,185,129,0.8)",
                  }}
                >
                  {speakerLabel(e.author)}
                </span>
                {e.timestamp && (
                  <span style={{ fontSize: 10, color: "rgba(71,85,105,0.7)" }}>{formatTime(e.timestamp)}</span>
                )}
              </div>
              <div
                style={{
                  maxWidth: "85%",
                  padding: "9px 13px",
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  border: `1px solid ${isUser ? "rgba(59,130,246,0.25)" : "rgba(16,185,129,0.2)"}`,
                  background: isUser ? "rgba(29,78,216,0.12)" : "rgba(6,78,53,0.14)",
                  color: "#cbd5e1",
                  borderTopRightRadius: isUser ? 3 : 12,
                  borderTopLeftRadius: isUser ? 12 : 3,
                }}
              >
                {textOf(e)}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
};
