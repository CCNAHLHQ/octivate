"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Volume2, X } from "lucide-react";
import {
  patchAlertPrefs,
  readAlertPrefs,
  subscribeAlertPrefs,
  type AlertPrefs,
} from "@/lib/alerts/prefs";
import { enableAlertSounds } from "@/lib/alerts/notify";
import { unlockAlertAudio } from "@/lib/alerts/sounds";
import { cn } from "@/lib/utils";

/**
 * Unlocks Web Audio on first gesture when alerts are already enabled,
 * and shows a one-time soft prompt to opt into alert sounds (workspace only).
 */
export function AlertsProvider() {
  const pathname = usePathname() || "";
  const inWorkspace =
    pathname.startsWith("/dashboard") || pathname === "/operator";
  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrefs(readAlertPrefs());
    return subscribeAlertPrefs(setPrefs);
  }, []);

  useEffect(() => {
    if (!prefs?.enabled || !prefs.sound) return;
    const unlock = () => {
      void unlockAlertAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [prefs?.enabled, prefs?.sound]);

  if (!inWorkspace || !prefs || prefs.promptSeen || prefs.enabled) return null;

  return (
    <div className="alert-opt-in" role="dialog" aria-label="Enable alert sounds">
      <div className="alert-opt-in-icon" aria-hidden>
        <Bell className="h-4 w-4" />
      </div>
      <div className="alert-opt-in-copy">
        <strong>Stay in the loop</strong>
        <span>
          Enable short alert sounds for briefs, projects, and customer support. You can change
          this anytime in Account → Alerts.
        </span>
      </div>
      <div className="alert-opt-in-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void enableAlertSounds().finally(() => setBusy(false));
          }}
        >
          <Volume2 className="h-3.5 w-3.5" aria-hidden />
          Enable sounds
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => patchAlertPrefs({ promptSeen: true })}
        >
          Not now
        </button>
        <Link
          href="/dashboard/account"
          className="alert-opt-in-link"
          onClick={() => patchAlertPrefs({ promptSeen: true })}
        >
          Settings
        </Link>
      </div>
      <button
        type="button"
        className={cn("alert-opt-in-close")}
        aria-label="Dismiss"
        onClick={() => patchAlertPrefs({ promptSeen: true })}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
