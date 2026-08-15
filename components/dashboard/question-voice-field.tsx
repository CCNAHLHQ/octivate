"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import { Mic, MicOff, ShieldAlert } from "lucide-react";
import { useSpeechDictation } from "@/lib/hooks/use-speech-dictation";
import { sanitizePlainText } from "@/lib/docs/sanitize-text";
import { toast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function QuestionVoiceField({
  value,
  onChange,
  disabled = false,
  placeholder,
  minLength = 10,
  required = true,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
}) {
  const t = useT();
  const secure =
    typeof window === "undefined"
      ? true
      : window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

  const valueRef = useRef(value);
  valueRef.current = value;

  const speech = useSpeechDictation({
    onFinal: (text) => {
      const clean = sanitizePlainText(text, 4_000);
      if (!clean) return;
      const prev = valueRef.current.trim();
      onChange(prev ? `${prev} ${clean}` : clean);
    },
  });

  const lastStatus = useRef(speech.status);
  useEffect(() => {
    if (lastStatus.current === speech.status) return;
    lastStatus.current = speech.status;
    if (speech.status === "denied") {
      toast.warning(t("ws.voice.blockedToast"));
    } else if (speech.status === "unsupported") {
      toast.info(t("ws.voice.unavailable"));
    } else if (speech.status === "error" && speech.error) {
      const soft = /no-speech|aborted/i.test(speech.error);
      if (!soft) toast.error(speech.error);
    }
  }, [speech.status, speech.error, t]);

  const listening = speech.status === "listening";
  const hasSpoken = Boolean(speech.finalText || speech.interim);
  const needsPermission =
    !listening &&
    (speech.permissionState === "prompt" || speech.status === "prompt");
  const denied = speech.status === "denied" || speech.permissionState === "denied";
  const unavailable = !speech.supported || !secure;

  function armMic(e: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement>) {
    // Keep modular-board / parent handlers from treating this as a drag start.
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!secure) {
      toast.error(t("ws.voice.needsHttps"));
      return;
    }
    if (denied) {
      toast.warning(t("ws.voice.settingsBlocked"));
      return;
    }
    if (unavailable) {
      toast.info(t("ws.voice.unavailable"));
      return;
    }
    // Start/stop in this gesture turn — no await before recognition.start().
    speech.toggle();
  }

  return (
    <div className={cn("ws-question-field", listening && "is-listening")}>
      <div className="ws-question-field-chrome">
        <button
          type="button"
          data-no-drag
          className={cn(
            "ws-voice-toggle",
            listening && "is-on",
            denied && "is-denied"
          )}
          disabled={disabled || (unavailable && !denied)}
          aria-pressed={listening}
          aria-label={
            listening
              ? t("ws.voice.stop")
              : denied
                ? t("ws.voice.blocked")
                : needsPermission
                  ? t("ws.voice.allow")
                  : t("ws.voice.tap")
          }
          onPointerDown={(e) => {
            // Stop board drag; do not start speech here (would double-fire with click).
            e.stopPropagation();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={armMic}
        >
          {listening ? (
            <>
              <Mic className="h-3.5 w-3.5" aria-hidden />
              {t("ws.voice.listening")}
            </>
          ) : denied ? (
            <>
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
              {t("ws.voice.micBlockedShort")}
            </>
          ) : unavailable ? (
            <>
              <MicOff className="h-3.5 w-3.5" aria-hidden />
              {t("ws.voice.unavailableShort")}
            </>
          ) : needsPermission ? (
            <>
              <Mic className="h-3.5 w-3.5" aria-hidden />
              {t("ws.voice.allowMicShort")}
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5" aria-hidden />
              {t("ws.voice.tap")}
            </>
          )}
        </button>
        <div className="ws-voice-wave" aria-hidden>
          {speech.levels.map((level, i) => (
            <span
              key={i}
              style={{ transform: `scaleY(${listening ? level : 0.12})` }}
            />
          ))}
        </div>
      </div>

      {denied && (
        <p className="ws-voice-hint">{t("ws.voice.deniedHint")}</p>
      )}

      {/* Always mounted so listening doesn’t reflow the modular card under the cursor */}
      <div
        className={cn("ws-voice-live", !(listening || hasSpoken) && "is-idle")}
        aria-live="polite"
        aria-hidden={!(listening || hasSpoken)}
      >
        <span className="ws-voice-live-label">{t("ws.voice.spoken")}</span>
        <p className={cn(!hasSpoken && "is-empty")}>
          {speech.finalText}
          {speech.interim ? (
            <span className="ws-voice-interim">
              {speech.finalText ? " " : ""}
              {speech.interim}
            </span>
          ) : null}
          {!hasSpoken &&
            (listening ? t("ws.voice.startSpeaking") : t("ws.voice.tapThenSpeak"))}
        </p>
      </div>

      <textarea
        className="ws-question-input"
        data-no-drag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder={placeholder || t("ws.voice.placeholder")}
        required={required}
        minLength={minLength}
        disabled={disabled}
      />
    </div>
  );
}
