"use client";

import React, { useRef, useState, useEffect } from "react";
import { Upload, FileText, FileImage, X, CheckCircle, AlertCircle } from "lucide-react";

type Props = {
  onUpload: (file: File) => Promise<string | null>;
  uploadedDoc: { name: string; documentId: string } | null;
  onClear: () => void;
  isUploading: boolean;
  disabled?: boolean;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className="w-8 h-8 text-blue-400" />;
  return <FileText className="w-8 h-8 text-slate-400" />;
}

// Simulated progress bar — reaches ~90% quickly, then waits for real completion
function useUploadProgress(isUploading: boolean) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!isUploading) { setProgress(0); return; }
    setProgress(5);
    const intervals = [
      setTimeout(() => setProgress(30), 200),
      setTimeout(() => setProgress(60), 600),
      setTimeout(() => setProgress(80), 1200),
      setTimeout(() => setProgress(90), 2000),
    ];
    return () => intervals.forEach(clearTimeout);
  }, [isUploading]);
  return progress;
}

export const DocumentUpload = ({ onUpload, uploadedDoc, onClear, isUploading, disabled }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const progress = useUploadProgress(isUploading);

  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

  const handleFile = async (file: File) => {
    setError(null);
    if (!allowed.includes(file.type)) {
      setError("Unsupported file type. Please upload a PDF, JPG, PNG, or WEBP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File too large. Maximum size is 20 MB.");
      return;
    }
    setPendingFile(file);
    const result = await onUpload(file);
    if (!result) {
      setError("Could not process the document. Please try again.");
      setPendingFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Success state
  if (uploadedDoc) {
    return (
      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-300 truncate">{uploadedDoc.name}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Clara has read your document and is ready</p>
          </div>
          {!disabled && (
            <button
              onClick={() => { onClear(); setPendingFile(null); }}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Remove document"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Uploading state — show file preview + progress bar
  if (isUploading && pendingFile) {
    return (
      <div className="rounded-xl border border-[#1e2d45] bg-[#0f1724] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <FileTypeIcon mimeType={pendingFile.type} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{pendingFile.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(pendingFile.size)}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-[#1e2d45] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">Reading your document…</p>
        </div>
      </div>
    );
  }

  // Default drop zone
  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) fileInputRef.current?.click(); }}
        aria-label="Upload legal document — click or drag and drop"
        className={`
          rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-150 select-none
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080e1a]
          ${dragOver ? "border-emerald-500 bg-emerald-950/20" : "border-[#1e2d45] hover:border-[#2a3f5f] hover:bg-[#0f1724]"}
          ${disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          disabled={disabled}
          aria-hidden="true"
        />
        <Upload className="w-6 h-6 mx-auto mb-3 text-slate-500" />
        <p className="text-sm font-semibold text-slate-300 mb-1">Drop your document here</p>
        <p className="text-xs text-slate-500 mb-3">or click to browse</p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {["PDF", "JPG", "PNG"].map((t) => (
            <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#1e2d45] text-slate-400">
              {t}
            </span>
          ))}
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#1e2d45] text-slate-400">
            Max 20 MB
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/20 border border-red-800/30 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <p className="text-[11px] text-slate-600 text-center leading-relaxed">
        Works with eviction notices, leases, debt letters, court summons, insurance denials & more
      </p>
    </div>
  );
};
