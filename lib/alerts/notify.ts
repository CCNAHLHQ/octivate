import { patchAlertPrefs, readAlertPrefs } from "@/lib/alerts/prefs";
import {
  playAlertSound,
  unlockAlertAudio,
  type AlertSoundKind,
} from "@/lib/alerts/sounds";

export { unlockAlertAudio } from "@/lib/alerts/sounds";

export type OctivateAlertInput = {
  kind?: AlertSoundKind;
  title: string;
  body?: string;
  /** Optional deep-link when a desktop notification is clicked. */
  href?: string;
  /** Runs when the desktop notification is clicked (before/with href). */
  onClick?: () => void;
  /** Force sound even if tab is focused (default true when sound enabled). */
  sound?: boolean;
  /** Force desktop notify even if tab focused (default: only when hidden). */
  desktop?: boolean;
};

const DEDUPE_MS = 1800;
const recent = new Map<string, number>();

function dedupe(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key) || 0;
  if (now - last < DEDUPE_MS) return true;
  recent.set(key, now);
  if (recent.size > 40) {
    for (const [k, t] of recent) {
      if (now - t > 10_000) recent.delete(k);
    }
  }
  return false;
}

export function desktopNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
}

/** Ask the browser for desktop notification permission (must be user-gesture). */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      patchAlertPrefs({ enabled: true, desktop: true, promptSeen: true });
    }
    return result;
  } catch {
    return Notification.permission;
  }
}

function showDesktopNotification(input: OctivateAlertInput) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(input.title, {
      body: input.body || undefined,
      tag: `octivate:${input.kind || "info"}:${input.title}`,
      silent: true, // we play our own jingle
    });
    if (input.href || input.onClick) {
      n.onclick = () => {
        try {
          window.focus();
          input.onClick?.();
          if (input.href) window.location.assign(input.href);
        } catch {
          /* ignore */
        }
        n.close();
      };
    }
    window.setTimeout(() => n.close(), 6000);
  } catch {
    /* ignore */
  }
}

/**
 * Play a SaaS jingle and/or show a desktop notification according to prefs.
 * Safe to call from anywhere client-side; no-ops when disabled or blocked.
 */
export async function octivateAlert(input: OctivateAlertInput): Promise<void> {
  if (typeof window === "undefined") return;
  const prefs = readAlertPrefs();
  if (!prefs.enabled) return;

  const kind = input.kind || "info";
  const key = `${kind}:${input.title}:${input.body || ""}`;
  if (dedupe(key)) return;

  const wantSound = prefs.sound && input.sound !== false;
  const wantDesktop =
    prefs.desktop &&
    (input.desktop === true || (input.desktop !== false && document.visibilityState === "hidden"));

  if (wantSound) {
    await unlockAlertAudio();
    await playAlertSound(kind);
  }
  if (wantDesktop) {
    showDesktopNotification(input);
  }
}

/** Enable sounds from a user gesture (prompt / settings). Plays a sample chime. */
export async function enableAlertSounds(): Promise<void> {
  patchAlertPrefs({ enabled: true, sound: true, promptSeen: true });
  await unlockAlertAudio();
  await playAlertSound("success");
}
