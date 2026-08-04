/** Device-local alert preferences (sound + desktop notifications). */

export const ALERT_PREFS_KEY = "octivate-alert-prefs";
export const ALERT_PREFS_EVENT = "octivate:alert-prefs";

export type AlertPrefs = {
  /** Master switch — when false, no sounds or desktop notifications. */
  enabled: boolean;
  /** Pleasant Web Audio jingles. */
  sound: boolean;
  /** Browser Notification API when the tab is in the background. */
  desktop: boolean;
  /** Soft workspace prompt has been answered or dismissed. */
  promptSeen: boolean;
};

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  enabled: false,
  sound: true,
  desktop: false,
  promptSeen: false,
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readAlertPrefs(): AlertPrefs {
  if (!canUseStorage()) return { ...DEFAULT_ALERT_PREFS };
  try {
    const raw = localStorage.getItem(ALERT_PREFS_KEY);
    if (!raw) return { ...DEFAULT_ALERT_PREFS };
    const parsed = JSON.parse(raw) as Partial<AlertPrefs>;
    return {
      enabled: Boolean(parsed.enabled),
      sound: parsed.sound !== false,
      desktop: Boolean(parsed.desktop),
      promptSeen: Boolean(parsed.promptSeen),
    };
  } catch {
    return { ...DEFAULT_ALERT_PREFS };
  }
}

export function writeAlertPrefs(next: AlertPrefs): AlertPrefs {
  const normalized: AlertPrefs = {
    enabled: Boolean(next.enabled),
    sound: next.sound !== false,
    desktop: Boolean(next.desktop),
    promptSeen: Boolean(next.promptSeen),
  };
  if (canUseStorage()) {
    try {
      localStorage.setItem(ALERT_PREFS_KEY, JSON.stringify(normalized));
    } catch {
      /* private mode */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ALERT_PREFS_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function patchAlertPrefs(patch: Partial<AlertPrefs>): AlertPrefs {
  return writeAlertPrefs({ ...readAlertPrefs(), ...patch });
}

export function subscribeAlertPrefs(listener: (prefs: AlertPrefs) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key !== ALERT_PREFS_KEY) return;
    listener(readAlertPrefs());
  };
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<AlertPrefs>).detail;
    listener(detail || readAlertPrefs());
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(ALERT_PREFS_EVENT, onCustom as EventListener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ALERT_PREFS_EVENT, onCustom as EventListener);
  };
}
