"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LogOut, Trash2 } from "lucide-react";
import { AlertsSettingsPanel } from "@/components/alerts/alerts-settings-panel";
import { AppShell } from "@/components/dashboard/app-shell";
import { BbcodeEditor } from "@/components/ui/bbcode-editor";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";
import {
  PRESENCE_OPTIONS,
  type PresenceStatus,
  type PublicUser,
} from "@/lib/auth/types";
import { cn } from "@/lib/utils";

type AccountTab = "profile" | "security" | "presence" | "alerts" | "session";

type ProfileLimits = {
  maxAvatarSizeKb: number;
  maxAvatarBytes: number;
  maxAvatarLabel?: string;
  maxProfileBioChars: number;
};

const TAB_KEYS: { id: AccountTab; labelKey: string }[] = [
  { id: "profile", labelKey: "ws.account.tab.profile" },
  { id: "security", labelKey: "ws.account.tab.security" },
  { id: "presence", labelKey: "ws.account.tab.presence" },
  { id: "alerts", labelKey: "ws.account.tab.alerts" },
  { id: "session", labelKey: "ws.account.tab.session" },
];

const FALLBACK_LIMITS: ProfileLimits = {
  maxAvatarSizeKb: 2048,
  maxAvatarBytes: 2048 * 1024,
  maxAvatarLabel: "2 MB",
  maxProfileBioChars: 2000,
};

function initials(user: PublicUser) {
  const base = (user.displayName || user.username || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function presenceOf(user: PublicUser | null): PresenceStatus {
  return user?.presenceStatus || "available";
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export default function AccountPage() {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<AccountTab>("profile");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [limits, setLimits] = useState<ProfileLimits>(FALLBACK_LIMITS);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const maxAvatarLabel =
    limits.maxAvatarLabel || `${Math.round(limits.maxAvatarSizeKb / 1024)} MB`;

  const load = useCallback(async () => {
    const res = await apiFetch<{
      user: PublicUser | null;
      profileLimits?: ProfileLimits;
    }>("/api/auth/me", { skipCache: true });
    if (!res.user) {
      router.replace("/signin");
      return;
    }
    setUser(res.user);
    setDisplayName(res.user.displayName);
    setDescription(res.user.description || "");
    if (res.profileLimits) setLimits(res.profileLimits);
  }, [router]);

  useEffect(() => {
    void load().catch(() => router.replace("/signin"));
  }, [load, router]);

  async function saveProfile() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ user: PublicUser; profileLimits?: ProfileLimits }>(
        "/api/auth/me",
        {
          method: "PATCH",
          json: { displayName, description },
        }
      );
      setUser(res.user);
      setDescription(res.user.description || "");
      if (res.profileLimits) setLimits(res.profileLimits);
      invalidateApiCache("/api/auth/me");
      toast.success(t("ws.account.profileSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ws.account.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        json: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      toast.success(t("ws.account.passwordUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ws.account.passwordFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function setPresence(next: PresenceStatus) {
    if (!user || busy || presenceOf(user) === next) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ user: PublicUser }>("/api/auth/me", {
        method: "PATCH",
        json: { presenceStatus: next },
      });
      setUser(res.user);
      invalidateApiCache("/api/auth/me");
      toast.success(`Status · ${t(`ws.account.presence.${next}`)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ws.account.statusFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onPick(file: File | null) {
    if (!file || busy) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toast.error(t("ws.account.imageType"));
      return;
    }
    if (file.size > limits.maxAvatarBytes) {
      toast.error(`Image must be under ${maxAvatarLabel}`);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await apiFetch<{ user: PublicUser; profileLimits?: ProfileLimits }>(
        "/api/auth/avatar",
        { method: "POST", json: { dataUrl } }
      );
      setUser(res.user);
      if (res.profileLimits) setLimits(res.profileLimits);
      invalidateApiCache("/api/auth/me");
      toast.success(t("ws.account.avatarUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ws.account.uploadFailed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ user: PublicUser }>("/api/auth/avatar", {
        method: "DELETE",
      });
      setUser(res.user);
      invalidateApiCache("/api/auth/me");
      toast.success(t("ws.account.avatarRemoved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ws.account.removeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST", json: {} });
      invalidateApiCache();
      window.location.replace("/signin?signed_out=1");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ws.account.signOutFailed"));
      setBusy(false);
    }
  }

  const presence = presenceOf(user);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">Account</p>
          <h1 className="mt-1 text-2xl font-semibold text-foam">{t("ws.account.title")}</h1>
          <p className="mt-1 text-sm text-mist">{t("ws.account.lede")}</p>
        </header>

        {!user ? (
          <p className="text-sm text-faint">{t("ws.account.loading")}</p>
        ) : (
          <div className="account-module">
            <div className="account-module-tabs" role="tablist" aria-label="Account settings">
              {TAB_KEYS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`account-tab-${item.id}`}
                  aria-selected={tab === item.id}
                  aria-controls={`account-panel-${item.id}`}
                  className={cn("account-module-tab", tab === item.id && "is-active")}
                  onClick={() => setTab(item.id)}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>

            <div className="account-module-body">
              {tab === "profile" ? (
                <section
                  className="account-module-panel card p-5"
                  role="tabpanel"
                  id="account-panel-profile"
                  aria-labelledby="account-tab-profile"
                >
                  <h2 className="text-sm font-semibold text-foam">
                    {t("ws.account.tab.profile")}
                  </h2>
                  <p className="mt-1 text-xs text-faint">
                    JPEG, PNG, or WebP · max {maxAvatarLabel} · magic-byte checked · private
                    storage
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      className="dash-account-avatar dash-account-avatar-lg"
                      disabled={busy}
                      onClick={() => inputRef.current?.click()}
                      aria-label={t("ws.account.uploadPhoto")}
                    >
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatarUrl} alt="" className="dash-account-avatar-img" />
                      ) : (
                        <span className="dash-account-avatar-fallback">{initials(user)}</span>
                      )}
                      <span className="dash-account-avatar-edit" aria-hidden>
                        <Camera className="h-3.5 w-3.5" />
                      </span>
                    </button>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => void onPick(e.target.files?.[0] || null)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => inputRef.current?.click()}
                      >
                        {t("ws.account.uploadPhoto")}
                      </button>
                      {user.avatarUrl ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => void removeAvatar()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("ws.account.remove")}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <label className="mt-5 block text-[11px] font-mono uppercase tracking-wider text-faint">
                    {t("ws.account.displayName")}
                    <input
                      className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--abyss)] px-3 py-2 text-sm text-foam"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={64}
                    />
                  </label>
                  <p className="mt-2 font-mono text-[11px] text-faint">
                    @{user.username} · {user.email} · {user.role}
                  </p>

                  <div className="mt-4">
                    <BbcodeEditor
                      label={t("ws.account.bio")}
                      value={description}
                      onChange={setDescription}
                      maxChars={limits.maxProfileBioChars}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm mt-4"
                    disabled={busy || displayName.trim().length < 2}
                    onClick={() => void saveProfile()}
                  >
                    {t("ws.account.saveProfile")}
                  </button>
                </section>
              ) : null}

              {tab === "security" ? (
                <section
                  className="account-module-panel card p-5"
                  role="tabpanel"
                  id="account-panel-security"
                  aria-labelledby="account-tab-security"
                >
                  <h2 className="text-sm font-semibold text-foam">{t("ws.account.password")}</h2>
                  <p className="mt-1 text-xs text-faint">
                    Confirm your current password before setting a new one (min 10 characters).
                  </p>
                  <label className="mt-3 block text-[11px] font-mono uppercase tracking-wider text-faint">
                    {t("ws.account.currentPassword")}
                    <input
                      type="password"
                      autoComplete="current-password"
                      className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--abyss)] px-3 py-2 text-sm text-foam"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </label>
                  <label className="mt-3 block text-[11px] font-mono uppercase tracking-wider text-faint">
                    {t("ws.account.newPassword")}
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--abyss)] px-3 py-2 text-sm text-foam"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mt-4"
                    disabled={busy || !currentPassword || newPassword.length < 10}
                    onClick={() => void savePassword()}
                  >
                    {t("ws.account.updatePassword")}
                  </button>
                </section>
              ) : null}

              {tab === "presence" ? (
                <section
                  className="account-module-panel card p-5"
                  role="tabpanel"
                  id="account-panel-presence"
                  aria-labelledby="account-tab-presence"
                >
                  <h2 className="text-sm font-semibold text-foam">
                    {t("ws.account.tab.presence")}
                  </h2>
                  <p className="mt-1 text-xs text-faint">{t("ws.account.presence.lede")}</p>

                  <ul
                    className="account-module-presence-list mt-4"
                    role="listbox"
                    aria-label={t("ws.account.presence")}
                  >
                    {PRESENCE_OPTIONS.map((opt) => (
                      <li key={opt.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={opt.id === presence}
                          disabled={busy}
                          className={cn(
                            "account-module-presence-option",
                            opt.id === presence && "is-active"
                          )}
                          onClick={() => void setPresence(opt.id)}
                        >
                          <span
                            className={cn("dash-account-presence-dot", `is-${opt.id}`)}
                            aria-hidden
                          />
                          <span className="dash-account-status-copy">
                            <strong>{t(`ws.account.presence.${opt.id}`)}</strong>
                            <em>{t(`ws.account.presence.${opt.id}Hint`)}</em>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {tab === "alerts" ? <AlertsSettingsPanel /> : null}

              {tab === "session" ? (
                <section
                  className="account-module-panel card p-5"
                  role="tabpanel"
                  id="account-panel-session"
                  aria-labelledby="account-tab-session"
                >
                  <h2 className="text-sm font-semibold text-foam">
                    {t("ws.account.tab.session")}
                  </h2>
                  <p className="mt-1 text-xs text-faint">
                    Sign out clears your session cookie on this device.
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mt-4"
                    disabled={busy}
                    onClick={() => void signOut()}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t("ws.account.signOut")}
                  </button>
                </section>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
