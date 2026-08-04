"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import {
  patchAlertPrefs,
  readAlertPrefs,
  subscribeAlertPrefs,
  type AlertPrefs,
} from "@/lib/alerts/prefs";
import {
  desktopNotificationPermission,
  enableAlertSounds,
  requestDesktopNotificationPermission,
} from "@/lib/alerts/notify";
import { playAlertSound, unlockAlertAudio } from "@/lib/alerts/sounds";
import { toast } from "@/components/ui/toast";

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="alert-switch">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="alert-switch-track" aria-hidden />
    </label>
  );
}

export function AlertsSettingsPanel() {
  const [prefs, setPrefs] = useState<AlertPrefs>(readAlertPrefs());
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrefs(readAlertPrefs());
    setPerm(desktopNotificationPermission());
    return subscribeAlertPrefs(setPrefs);
  }, []);

  async function setEnabled(next: boolean) {
    if (next) {
      setBusy(true);
      try {
        await enableAlertSounds();
        toast.success("Alert sounds enabled");
      } finally {
        setBusy(false);
      }
      return;
    }
    patchAlertPrefs({ enabled: false, promptSeen: true });
    toast.info("Alerts muted");
  }

  async function setSound(next: boolean) {
    const updated = patchAlertPrefs({ sound: next, enabled: next ? true : prefs.enabled });
    setPrefs(updated);
    if (next && updated.enabled) {
      await unlockAlertAudio();
      await playAlertSound("info");
    }
  }

  async function setDesktop(next: boolean) {
    if (next) {
      setBusy(true);
      try {
        const result = await requestDesktopNotificationPermission();
        setPerm(result);
        if (result === "granted") {
          patchAlertPrefs({ enabled: true, desktop: true, promptSeen: true });
          toast.success("Desktop notifications enabled");
        } else if (result === "denied") {
          patchAlertPrefs({ desktop: false });
          toast.warning("Desktop notifications are blocked in this browser");
        } else if (result === "unsupported") {
          toast.warning("Desktop notifications are not supported here");
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    setPrefs(patchAlertPrefs({ desktop: false }));
  }

  async function preview() {
    setBusy(true);
    try {
      await unlockAlertAudio();
      await playAlertSound("success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="account-module-panel card p-5"
      role="tabpanel"
      id="account-panel-alerts"
      aria-labelledby="account-tab-alerts"
    >
      <h2 className="text-sm font-semibold text-foam">Alerts</h2>
      <p className="mt-1 text-xs text-faint">
        Pleasant short jingles and optional desktop notifications for briefs, projects, and
        customer support. Nothing plays until you enable alerts.
      </p>

      <div className="mt-4">
        <div className="alert-toggle-row">
          <div className="alert-toggle-copy">
            <strong>Alerts</strong>
            <span>Global master switch for sound and desktop notifications on this device.</span>
          </div>
          <Switch
            label="Enable alerts"
            checked={prefs.enabled}
            disabled={busy}
            onChange={(v) => void setEnabled(v)}
          />
        </div>

        <div className="alert-toggle-row">
          <div className="alert-toggle-copy">
            <strong>Sound</strong>
            <span>Soft SaaS-style chimes when something important finishes or arrives.</span>
          </div>
          <Switch
            label="Enable alert sounds"
            checked={prefs.sound && prefs.enabled}
            disabled={busy || !prefs.enabled}
            onChange={(v) => void setSound(v)}
          />
        </div>

        <div className="alert-toggle-row">
          <div className="alert-toggle-copy">
            <strong>Desktop notifications</strong>
            <span>
              Show a system notification when Octivate is in the background.
              {perm === "denied"
                ? " Currently blocked by the browser — allow notifications for this site to use this."
                : perm === "unsupported"
                  ? " Not supported in this browser."
                  : perm === "granted"
                    ? " Permission granted."
                    : " Permission will be requested when you enable this."}
            </span>
          </div>
          <Switch
            label="Enable desktop notifications"
            checked={prefs.desktop && prefs.enabled && perm === "granted"}
            disabled={busy || !prefs.enabled || perm === "unsupported" || perm === "denied"}
            onChange={(v) => void setDesktop(v)}
          />
        </div>
      </div>

      <button
        type="button"
        className="btn btn-ghost btn-sm mt-3"
        disabled={busy || !prefs.enabled || !prefs.sound}
        onClick={() => void preview()}
      >
        <Volume2 className="h-3.5 w-3.5" aria-hidden />
        Preview sound
      </button>
    </section>
  );
}
