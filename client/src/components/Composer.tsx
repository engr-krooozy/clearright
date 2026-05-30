"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";

// Text composer — lets the user type a question to Clara while connected,
// as an alternative to speaking. Enter sends; Shift+Enter inserts a newline.

export const Composer = ({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) => {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className="flex items-end gap-2 px-3 py-2.5 border-t border-[#1e2d45] flex-shrink-0"
      style={{ background: "rgba(8,14,26,0.4)" }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        rows={1}
        placeholder={disabled ? "Connect to type a question…" : "Type a question to Clara…"}
        aria-label="Type a question to Clara"
        className="flex-1 resize-none bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none disabled:opacity-50 max-h-28 py-1.5 px-2 rounded-lg border border-[#1e2d45] focus:border-emerald-600/50 transition-colors"
        style={{ minHeight: 38 }}
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        aria-label="Send message"
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 flex-shrink-0"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
};
