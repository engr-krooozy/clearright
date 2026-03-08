import { useState, useRef, useCallback } from "react";
import { arrayBufferToBase64, base64ToArray } from "@/utils/encoding";
import { StructuredAgentEvent } from "@/components/ConversationPanel";
import { DocAnalysis } from "@/components/ConversationPanel";

const RECORDER_WORKLET_PATH = "/audio-recorder-worklet.js";
const PLAYER_WORKLET_PATH = "/audio-player-worklet.js";
const FRAME_CAPTURE_INTERVAL_MS = 1000;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

type ConnectionState = "idle" | "connecting" | "connected" | "closing" | "closed" | "error";

export function useLiveConnection() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [eventLog, setEventLog] = useState<StructuredAgentEvent[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState<{ name: string; documentId: string; analysis: DocAnalysis | null } | null>(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const micLevelRef = useRef(0);

  const agentTextBufferRef = useRef<string>("");
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const videoLoopRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerContextRef = useRef<AudioContext | null>(null);
  const audioPlayerNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioRecorderContextRef = useRef<AudioContext | null>(null);
  const audioRecorderNodeRef = useRef<AudioWorkletNode | null>(null);

  const sendMessage = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    sendMessage({ mime_type: "text/plain", data: text });
  }, [sendMessage]);

  const uploadDocument = useCallback(async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }

      const data = await res.json();
      setUploadedDoc({ name: file.name, documentId: data.document_id, analysis: data.analysis ?? null });
      return data.document_id;
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const clearDocument = useCallback(() => {
    setUploadedDoc(null);
  }, []);

  const startVideoFrameCapture = useCallback(() => {
    if (videoLoopRef.current) clearInterval(videoLoopRef.current);
    videoLoopRef.current = setInterval(() => {
      const video = videoElementRef.current;
      const canvas = canvasElementRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_METADATA) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const base64Data = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
      sendMessage({ mime_type: "image/jpeg", data: base64Data });
    }, FRAME_CAPTURE_INTERVAL_MS);
  }, [sendMessage]);

  const stopVideoFrameCapture = useCallback(() => {
    if (videoLoopRef.current) {
      clearInterval(videoLoopRef.current);
      videoLoopRef.current = null;
    }
  }, []);

  const setupAudioRecording = useCallback(async (stream: MediaStream) => {
    if (!stream.getAudioTracks().length) return;
    // Create once, reuse across sessions — closing/recreating causes Chrome worklet bugs
    if (!audioRecorderContextRef.current || audioRecorderContextRef.current.state === "closed") {
      audioRecorderContextRef.current = new AudioContext({ sampleRate: 16000 });
    }
    const ctx = audioRecorderContextRef.current;
    if (ctx.state === "suspended") await ctx.resume();
    try {
      await ctx.audioWorklet.addModule(RECORDER_WORKLET_PATH);
    } catch (e) {
      // Module may already be registered on context reuse — only fatal if truly new
      console.warn("Audio recorder worklet addModule:", e);
    }
    const source = ctx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(ctx, "audio-recorder-processor");
    worklet.port.onmessage = (e) => {
      if (e.data.type === "audio_data") {
        sendMessage({ mime_type: "audio/pcm", data: arrayBufferToBase64(e.data.buffer) });
        // Smooth energy with exponential moving average, normalize to 0–1
        const raw = e.data.energy ?? 0;
        micLevelRef.current = micLevelRef.current * 0.75 + raw * 0.25;
        setMicrophoneLevel(Math.min(1, micLevelRef.current / 0.12));
      } else if (e.data.type === "speech_start") {
        audioPlayerNodeRef.current?.port.postMessage({ type: "flush" });
        setIsUserSpeaking(true);
        setIsAgentSpeaking(false);
      } else if (e.data.type === "speech_end") {
        setIsUserSpeaking(false);
        setMicrophoneLevel(0);
        micLevelRef.current = 0;
      }
    };
    source.connect(worklet);
    audioRecorderNodeRef.current = worklet;
  }, [sendMessage]);

  const setupAudioPlayback = useCallback(async () => {
    // Create once, reuse across sessions — closing/recreating causes Chrome worklet bugs
    if (!audioPlayerContextRef.current || audioPlayerContextRef.current.state === "closed") {
      audioPlayerContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = audioPlayerContextRef.current;
    if (ctx.state === "suspended") await ctx.resume();
    try {
      await ctx.audioWorklet.addModule(PLAYER_WORKLET_PATH);
      const player = new AudioWorkletNode(ctx, "audio-player-processor");
      player.connect(ctx.destination);
      audioPlayerNodeRef.current = player;
    } catch (e) {
      console.error("Audio player worklet error:", e);
    }
  }, []);

  const connect = useCallback(async (
    videoEl: HTMLVideoElement,
    canvasEl: HTMLCanvasElement,
    userId: string,
    source: "camera" | "screen",
    documentId?: string,
  ) => {
    setConnectionState("connecting");
    setEventLog([]);
    videoElementRef.current = videoEl;
    canvasElementRef.current = canvasEl;

    try {
      let stream: MediaStream;
      if (source === "screen") {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1280, height: 720 }, audio: false });
        let mic: MediaStream | null = null;
        try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); } catch {}
        stream = mic?.getAudioTracks().length
          ? new MediaStream([...screen.getVideoTracks(), ...mic.getAudioTracks()])
          : screen;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: { width: 1280, height: 720 } });
      }

      mediaStreamRef.current = stream;
      videoEl.srcObject = stream;
      videoEl.play().catch((e) => {
        if (e.name !== "AbortError") console.error("Video play error:", e);
      });

      const wsUrl = documentId
        ? `${WS_BASE}/ws/${userId}?document_id=${documentId}`
        : `${WS_BASE}/ws/${userId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState("connected");
        setupAudioRecording(stream);
        setupAudioPlayback();
        startVideoFrameCapture();
      };

      ws.onmessage = (event) => {
        const agentEvent = JSON.parse(event.data) as StructuredAgentEvent;

        // DEBUG — remove after diagnosis
        const debugEvent = { ...agentEvent, parts: agentEvent.parts.map(p => p.type === "audio/pcm" ? { type: "audio/pcm", data: "[AUDIO]" } : p) };
        console.log("[WS]", JSON.stringify(debugEvent));

        // ── Audio playback ──────────────────────────────────────────────────
        const hasAudio = agentEvent.parts.some((p) => p.type === "audio/pcm");
        if (hasAudio) setIsAgentSpeaking(true);
        if (agentEvent.turn_complete || agentEvent.interrupted) {
          setIsAgentSpeaking(false);
          setIsUserSpeaking(false);
        }
        for (const part of agentEvent.parts) {
          if (part.type === "audio/pcm") {
            const bytes = base64ToArray(part.data);
            audioPlayerNodeRef.current?.port.postMessage(
              { type: "audio_data", buffer: bytes.buffer },
              [bytes.buffer]
            );
          }
        }

        // ── User speech transcription → log immediately ─────────────────────
        if (agentEvent.input_transcription?.is_final) {
          setEventLog((prev) => [...prev, {
            id: crypto.randomUUID(),
            author: "user",
            is_partial: false,
            turn_complete: true,
            parts: [{ type: "text", data: agentEvent.input_transcription!.text }],
          }]);
        }

        // ── Tool calls/responses → log immediately (no partial filter) ──────
        const toolParts = agentEvent.parts.filter(
          (p) => p.type === "function_call" || p.type === "function_response"
        );
        if (toolParts.length > 0) {
          setEventLog((prev) => [...prev, {
            id: crypto.randomUUID(),
            author: "agent",
            is_partial: false,
            turn_complete: false,
            parts: toolParts,
          }]);
        }

        // ── Agent text → accumulate partial chunks, commit on turn_complete ─
        const isThinkingText = (text: string) =>
          /\*\*[A-Z][^*]+\*\*/.test(text.slice(0, 60));
        const textChunk = agentEvent.parts
          .filter((p) => p.type === "text" && !isThinkingText(p.data))
          .map((p) => p.data)
          .join("");
        if (textChunk) agentTextBufferRef.current += textChunk;

        if (agentEvent.turn_complete) {
          const fullText = agentTextBufferRef.current.trim();
          if (fullText) {
            setEventLog((prev) => [...prev, {
              id: crypto.randomUUID(),
              author: "agent",
              is_partial: false,
              turn_complete: true,
              parts: [{ type: "text", data: fullText }],
            }]);
          }
          agentTextBufferRef.current = "";
        }
      };

      ws.onclose = () => disconnect();
      ws.onerror = () => { setConnectionState("error"); disconnect(); };
    } catch (e) {
      console.error("Connection error:", e);
      setConnectionState("error");
    }
  }, [setupAudioRecording, setupAudioPlayback, startVideoFrameCapture]);

  const disconnect = useCallback(() => {
    setConnectionState("closing");
    wsRef.current?.close();
    wsRef.current = null;
    stopVideoFrameCapture();
    // Suspend (not close) so the AudioContext + worklet thread stay alive for reuse
    audioRecorderNodeRef.current?.disconnect();
    audioRecorderNodeRef.current = null;
    audioRecorderContextRef.current?.suspend().catch(() => {});
    audioPlayerNodeRef.current?.disconnect();
    audioPlayerNodeRef.current = null;
    audioPlayerContextRef.current?.suspend().catch(() => {});
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (videoElementRef.current) videoElementRef.current.srcObject = null;
    setIsAgentSpeaking(false);
    setIsUserSpeaking(false);
    setMicrophoneLevel(0);
    micLevelRef.current = 0;
    agentTextBufferRef.current = "";
    setConnectionState("closed");
  }, [stopVideoFrameCapture]);

  return {
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
  };
}
