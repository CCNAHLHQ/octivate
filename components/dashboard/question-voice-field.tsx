"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { Mic, MicOff, ShieldAlert } from "lucide-react";
import { useSpeechDictation } from "@/lib/hooks/use-speech-dictation";
import { sanitizePlainText } from "@/lib/docs/sanitize-text";
import { toast } from "@/components/ui/toast";
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
      toast.warning(
        "Microphone access was blocked. Allow the mic for this site, then try again."
      );
    } else if (speech.status === "unsupported") {
      toast.info("Voice dictation isn’t available in this browser — type instead.");
    } else if (speech.status === "error" && speech.error) {
      const soft = /no-speech|aborted/i.test(speech.error);
      if (!soft) toast.error(speech.error);
    }
  }, [speech.status, speech.error]);

  const listening = speech.status === "listening";
  const hasSpoken = Boolean(speech.finalText || speech.interim);
  const needsPermission =
    !listening &&
    (speech.permissionState === "prompt" || speech.status === "prompt");
  const denied = speech.status === "denied" || speech.permissionState === "denied";
  const unavailable = !speech.supported || !secure;

  function handleMicClick(e: MouseEvent<HTMLButtonElement>) {
    // Keep modular-board / parent handlers from treating this as a drag start.
    e.stopPropagation();
    if (disabled) return;
    if (!secure) {
      toast.error("Voice needs HTTPS (or localhost). Open the secure site URL.");
      return;
    }
    if (denied) {
      toast.warning(
        "Mic is blocked in browser settings. Click the lock icon → Site settings → Microphone → Allow."
      );
      return;
    }
    if (unavailable) {
      toast.info("Voice dictation isn’t available in this browser — type instead.");
      return;
    }
    // Fire recognition in this click turn — do not await permission first.
    void speech.toggle();
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
              ? "Stop listening"
              : denied
                ? "Microphone blocked"
                : needsPermission
                  ? "Allow microphone and speak"
                  : "Tap to speak"
          }
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleMicClick}
        >
          {listening ? (
            <>
              <Mic className="h-3.5 w-3.5" aria-hidden />
              Listening…
            </>
          ) : denied ? (
            <>
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
              Mic blocked
            </>
          ) : unavailable ? (
            <>
              <MicOff className="h-3.5 w-3.5" aria-hidden />
              Voice unavailable
            </>
          ) : needsPermission ? (
            <>
              <Mic className="h-3.5 w-3.5" aria-hidden />
              Allow mic
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5" aria-hidden />
              Tap to speak
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
        <p className="ws-voice-hint">
          Allow the microphone for this site (browser lock icon → Microphone → Allow), then
          press the mic button again.
        </p>
      )}

      {/* Always mounted so listening doesn’t reflow the modular card under the cursor */}
      <div
        className={cn("ws-voice-live", !(listening || hasSpoken) && "is-idle")}
        aria-live="polite"
        aria-hidden={!(listening || hasSpoken)}
      >
        <span className="ws-voice-live-label">Spoken</span>
        <p className={cn(!hasSpoken && "is-empty")}>
          {speech.finalText}
          {speech.interim ? (
            <span className="ws-voice-interim">
              {speech.finalText ? " " : ""}
              {speech.interim}
            </span>
          ) : null}
          {!hasSpoken &&
            (listening
              ? "Start speaking — your words appear here live."
              : "Tap the mic, then speak — words appear here live.")}
        </p>
      </div>

      <textarea
        className="ws-question-input"
        data-no-drag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder={
          placeholder ||
          "What strategic decision do you need evidence-backed judgment on?"
        }
        required={required}
        minLength={minLength}
        disabled={disabled}
      />
    </div>
  );
}
