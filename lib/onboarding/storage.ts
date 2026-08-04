import { WORKSPACE_INTRO_STORAGE_KEY, WORKSPACE_INTRO_STEPS } from "@/lib/onboarding/content";

export type IntroPersistState = {
  seen: boolean;
  completed: boolean;
};

type StoredIntro = {
  seen?: boolean;
  completed?: boolean;
};

export type IntroSessionState = {
  open: boolean;
  step: number;
};

const SESSION_KEY = `${WORKSPACE_INTRO_STORAGE_KEY}:session`;

function readStored(): StoredIntro {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(WORKSPACE_INTRO_STORAGE_KEY);
    if (!raw) return {};
    if (raw === "done") return { seen: true, completed: true };
    return JSON.parse(raw) as StoredIntro;
  } catch {
    return {};
  }
}

function writeStored(next: StoredIntro) {
  try {
    localStorage.setItem(WORKSPACE_INTRO_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function readIntroState(): IntroPersistState {
  const stored = readStored();
  return {
    seen: Boolean(stored.seen),
    completed: Boolean(stored.completed),
  };
}

/** Remember that the tour was opened so it does not auto-show again. */
export function markIntroSeen() {
  const stored = readStored();
  if (stored.seen) return;
  writeStored({ ...stored, seen: true });
}

/** User finished or skipped the tour. */
export function markIntroComplete() {
  writeStored({ seen: true, completed: true });
  clearIntroSession();
}

export function shouldAutoShowIntro(): boolean {
  return !readIntroState().seen;
}

/** Survive AppShell remounts during multi-route tour navigation. */
export function readIntroSession(): IntroSessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntroSessionState;
    if (!parsed?.open) return null;
    const step = Math.max(0, Math.min(WORKSPACE_INTRO_STEPS.length - 1, Number(parsed.step) || 0));
    return { open: true, step };
  } catch {
    return null;
  }
}

export function writeIntroSession(next: IntroSessionState) {
  if (typeof window === "undefined") return;
  try {
    if (!next.open) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        open: true,
        step: Math.max(0, Math.min(WORKSPACE_INTRO_STEPS.length - 1, next.step)),
      })
    );
  } catch {
    /* ignore */
  }
}

export function clearIntroSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
