"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpeechInput } from "@syntropy-labs/react-web-speech";

export type SpeechStatus =
  | "idle"
  | "listening"
  | "unsupported"
  | "denied"
  | "error"
  | "prompt";

export type MicPermissionState = "prompt" | "granted" | "denied" | "unsupported";

/**
 * Voice dictation via @syntropy-labs/react-web-speech.
 * Critical: do not await getUserMedia before SpeechRecognition.start() —
 * that drops the user-gesture token and makes "Tap to speak" appear dead.
 */
export function useSpeechDictation(opts?: {
  lang?: string;
  onFinal?: (text: string) => void;
}) {
  const onFinalRef = useRef(opts?.onFinal);
  onFinalRef.current = opts?.onFinal;
  const [levels, setLevels] = useState<number[]>(() => Array(24).fill(0.12));
  const rafRef = useRef<number | null>(null);
  /** True after a successful grant or successful recognition start this session. */
  const grantedLatch = useRef(false);
  const toggleInflight = useRef(false);

  const onResult = useCallback((text: string, isFinal: boolean) => {
    if (!isFinal) return;
    const cleaned = String(text || "").trim();
    if (cleaned) onFinalRef.current?.(cleaned);
  }, []);

  const speech = useSpeechInput({
    lang: opts?.lang || "en-US",
    continuous: true,
    interimResults: true,
    silenceTimeout: 8_000,
    // Avoid restart loops that can re-surface permission / InvalidState races.
    autoRestart: false,
    onResult,
  });

  const startRef = useRef(speech.start);
  const stopRef = useRef(speech.stop);
  const clearRef = useRef(speech.clear);
  const requestPermissionRef = useRef(speech.requestPermission);
  startRef.current = speech.start;
  stopRef.current = speech.stop;
  clearRef.current = speech.clear;
  requestPermissionRef.current = speech.requestPermission;

  useEffect(() => {
    if (speech.permissionState === "granted") grantedLatch.current = true;
    if (speech.permissionState === "denied") grantedLatch.current = false;
  }, [speech.permissionState]);

  useEffect(() => {
    if (speech.isListening) grantedLatch.current = true;
  }, [speech.isListening]);

  const status: SpeechStatus = useMemo(() => {
    if (!speech.isSupported || speech.permissionState === "unsupported") {
      return "unsupported";
    }
    if (speech.permissionState === "denied") return "denied";
    if (speech.error) {
      const code = speech.error.type;
      if (code === "not-allowed" || code === "service-not-allowed") return "denied";
      if (code === "no-speech" || code === "aborted") {
        return speech.isListening ? "listening" : "idle";
      }
      return "error";
    }
    if (speech.isListening) return "listening";
    if (speech.permissionState === "prompt" && !grantedLatch.current) return "prompt";
    return "idle";
  }, [
    speech.isSupported,
    speech.permissionState,
    speech.error,
    speech.isListening,
  ]);

  useEffect(() => {
    if (!speech.isListening) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setLevels(Array(24).fill(0.12));
      return;
    }
    let t = 0;
    const tick = () => {
      t += 0.18;
      const next = Array.from({ length: 24 }, (_, i) => {
        const wave =
          0.25 +
          0.55 *
            Math.abs(Math.sin(t + i * 0.45)) *
            (0.55 + 0.45 * Math.abs(Math.sin(t * 1.7 + i * 0.2)));
        return Math.max(0.1, Math.min(1, wave));
      });
      setLevels(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [speech.isListening]);

  const start = useCallback(async () => {
    if (!speech.isSupported) return;
    if (speech.permissionState === "denied") return;
    if (speech.isListening) return;

    try {
      // Must stay in the click gesture — no await before recognition.start().
      await startRef.current();
      grantedLatch.current = true;
    } catch {
      /* InvalidStateError / abort — ignore */
    }
  }, [speech.isSupported, speech.permissionState, speech.isListening]);

  const stop = useCallback(() => {
    stopRef.current();
  }, []);

  const toggle = useCallback(async () => {
    if (toggleInflight.current) return;
    toggleInflight.current = true;
    try {
      if (speech.isListening) {
        stopRef.current();
        return;
      }
      await start();
    } finally {
      toggleInflight.current = false;
    }
  }, [speech.isListening, start]);

  const clearSpoken = useCallback(() => {
    clearRef.current();
  }, []);

  const requestPermission = useCallback(async (): Promise<MicPermissionState> => {
    if (!speech.isSupported) return "unsupported";
    if (speech.permissionState === "denied") return "denied";
    if (grantedLatch.current || speech.permissionState === "granted") {
      return "granted";
    }
    try {
      const next = (await requestPermissionRef.current()) as MicPermissionState;
      if (next === "granted") grantedLatch.current = true;
      return next;
    } catch {
      return "denied";
    }
  }, [speech.isSupported, speech.permissionState]);

  const errorMessage = speech.error
    ? String(speech.error.message || speech.error.type || "Speech recognition error")
    : null;

  const permissionState: MicPermissionState =
    speech.permissionState === "denied"
      ? "denied"
      : speech.permissionState === "unsupported"
        ? "unsupported"
        : grantedLatch.current || speech.permissionState === "granted"
          ? "granted"
          : (speech.permissionState as MicPermissionState);

  return {
    supported: speech.isSupported && speech.permissionState !== "unsupported",
    status,
    permissionState,
    interim: speech.interimTranscript || "",
    finalText: speech.transcript || "",
    levels,
    error: errorMessage,
    start,
    stop,
    toggle,
    clearSpoken,
    requestPermission,
  };
}
