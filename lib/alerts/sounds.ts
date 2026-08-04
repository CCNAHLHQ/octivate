/**
 * Short SaaS-style jingles via Web Audio (no asset files).
 * Soft, quick, non-jarring — success / message / info / soft error.
 */

export type AlertSoundKind = "success" | "message" | "info" | "soft";

type Tone = { freq: number; start: number; dur: number; gain: number; type?: OscillatorType };

const PATTERNS: Record<AlertSoundKind, Tone[]> = {
  /* Soft major sparkle — brief / project success */
  success: [
    { freq: 523.25, start: 0, dur: 0.09, gain: 0.09, type: "sine" },
    { freq: 659.25, start: 0.07, dur: 0.1, gain: 0.08, type: "sine" },
    { freq: 783.99, start: 0.14, dur: 0.16, gain: 0.07, type: "triangle" },
  ],
  /* Two-tone chime — support message */
  message: [
    { freq: 698.46, start: 0, dur: 0.11, gain: 0.08, type: "sine" },
    { freq: 880.0, start: 0.1, dur: 0.14, gain: 0.07, type: "triangle" },
  ],
  /* Gentle single blip — informational */
  info: [{ freq: 587.33, start: 0, dur: 0.12, gain: 0.07, type: "sine" }],
  /* Soft descending pair — gentle attention */
  soft: [
    { freq: 493.88, start: 0, dur: 0.1, gain: 0.07, type: "sine" },
    { freq: 392.0, start: 0.09, dur: 0.14, gain: 0.06, type: "triangle" },
  ],
};

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Call from a user gesture so browsers allow subsequent alert playback. */
export async function unlockAlertAudio(): Promise<boolean> {
  const audio = getCtx();
  if (!audio) return false;
  try {
    if (audio.state === "suspended") await audio.resume();
    unlocked = audio.state === "running";
    return unlocked;
  } catch {
    return false;
  }
}

export function isAlertAudioUnlocked() {
  return unlocked && !!ctx && ctx.state === "running";
}

function playTone(audio: AudioContext, tone: Tone, when: number) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = tone.type || "sine";
  osc.frequency.value = tone.freq;
  const t0 = when + tone.start;
  const peak = Math.max(0.001, tone.gain);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.dur);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + tone.dur + 0.02);
}

export async function playAlertSound(kind: AlertSoundKind = "info"): Promise<void> {
  const audio = getCtx();
  if (!audio) return;
  try {
    if (audio.state === "suspended") await audio.resume();
    unlocked = audio.state === "running";
    if (!unlocked) return;
    const now = audio.currentTime + 0.01;
    for (const tone of PATTERNS[kind] || PATTERNS.info) {
      playTone(audio, tone, now);
    }
  } catch {
    /* autoplay blocked — ignore */
  }
}
