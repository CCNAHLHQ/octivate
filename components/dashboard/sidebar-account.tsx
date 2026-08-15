"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ChevronDown, LogOut, Settings } from "lucide-react";
import {
  setOptionalAuthUser,
  useOptionalAuth,
} from "@/components/auth/use-optional-auth";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";
import {
  PRESENCE_OPTIONS,
  type PresenceStatus,
  type PublicUser,
} from "@/lib/auth/types";
import { cn } from "@/lib/utils";

type ProfileLimits = {
  maxAvatarSizeKb: number;
  maxAvatarBytes: number;
  maxAvatarLabel?: string;
  maxProfileBioChars: number;
};

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

export function SidebarAccountCard({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const { user, ready } = useOptionalAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [limits, setLimits] = useState<ProfileLimits>(FALLBACK_LIMITS);
  const [busy, setBusy] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ profileLimits?: ProfileLimits }>("/api/auth/me", { skipCache: true })
      .then((res) => {
        if (!cancelled && res.profileLimits) setLimits(res.profileLimits);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const placeMenu = useCallback(() => {
    const btn = statusBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = Math.max(r.width, 240);
    const menuH = menuRef.current?.offsetHeight || 228;
    const gap = 8;
    const spaceAbove = r.top;
    const spaceBelow = window.innerHeight - r.bottom;
    const preferAbove = spaceAbove >= menuH + gap || spaceAbove > spaceBelow;
    let top = preferAbove ? r.top - menuH - gap : r.bottom + gap;
    top = Math.min(
      Math.max(8, top),
      window.innerHeight - Math.min(menuH, window.innerHeight - 16) - 8
    );
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    setMenuPos({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!statusOpen) return;
    placeMenu();
    const id = window.requestAnimationFrame(() => placeMenu());
    const onReposition = () => placeMenu();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [statusOpen, placeMenu]);

  useEffect(() => {
    if (!statusOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node | null;
      if (statusBtnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setStatusOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setStatusOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [statusOpen]);

  async function signOut() {
    setBusy(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST", json: {} });
      invalidateApiCache();
      setOptionalAuthUser(null);
      window.location.replace("/signin?signed_out=1");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed");
      setBusy(false);
    }
  }

  async function setPresence(next: PresenceStatus) {
    setStatusOpen(false);
    if (!user || presenceOf(user) === next) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ user: PublicUser }>("/api/auth/me", {
        method: "PATCH",
        json: { presenceStatus: next },
      });
      setOptionalAuthUser(res.user);
      invalidateApiCache("/api/auth/me");
      toast.success(`Status · ${PRESENCE_OPTIONS.find((p) => p.id === next)?.label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  }

  async function onPick(file: File | null) {
    if (!file || busy) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toast.error("Use JPEG, PNG, or WebP");
      return;
    }
    const label = limits.maxAvatarLabel || `${Math.round(limits.maxAvatarSizeKb / 1024)} MB`;
    if (file.size > limits.maxAvatarBytes) {
      toast.error(`Image must be under ${label}`);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await apiFetch<{ user: PublicUser }>("/api/auth/avatar", {
        method: "POST",
        json: { dataUrl },
      });
      setOptionalAuthUser(res.user);
      invalidateApiCache("/api/auth/me");
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!ready) {
    return (
      <div className={cn("dash-account", className)} aria-busy="true">
        <div className="dash-account-label">Account</div>
        <div className="dash-account-skeleton" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn("dash-account", className)}>
        <div className="dash-account-label">Account</div>
        <Link href="/signin" onClick={onNavigate} className="dash-account-action is-primary">
          Sign in
        </Link>
      </div>
    );
  }

  const presence = presenceOf(user);
  const presenceMeta = PRESENCE_OPTIONS.find((p) => p.id === presence)!;

  const statusMenu =
    mounted && statusOpen
      ? createPortal(
          <ul
            ref={menuRef}
            className="dash-account-status-menu is-portal"
            role="listbox"
            aria-label="Presence status"
            style={{
              top: menuPos?.top ?? -9999,
              left: menuPos?.left ?? 0,
              width: menuPos?.width ?? 240,
              visibility: menuPos ? "visible" : "hidden",
            }}
          >
            {PRESENCE_OPTIONS.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.id === presence}
                  className={cn(opt.id === presence && "is-active")}
                  onClick={() => void setPresence(opt.id)}
                >
                  <span className={cn("dash-account-presence-dot", `is-${opt.id}`)} />
                  <span className="dash-account-status-copy">
                    <strong>{opt.label}</strong>
                    <em>{opt.supportHint}</em>
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className={cn("dash-account", className)}>
      <div className="dash-account-label">Account</div>

      <div className="dash-account-card">
        <div className="dash-account-stack">
          <button
            type="button"
            className={cn("dash-account-avatar", `is-presence-${presence}`)}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            aria-label="Change profile photo"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="dash-account-avatar-img" />
            ) : (
              <span className="dash-account-avatar-fallback">{initials(user)}</span>
            )}
            <span className={cn("dash-account-presence-dot", `is-${presence}`)} aria-hidden />
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

          <div className="dash-account-text">
            <p className="dash-account-name" title={user.displayName}>
              {user.displayName}
            </p>
            <p className="dash-account-meta" title={`@${user.username} · ${user.role}`}>
              @{user.username} · {user.role}
            </p>
          </div>

          <div className="dash-account-status">
            <button
              ref={statusBtnRef}
              type="button"
              className={cn("dash-account-status-btn", `is-${presence}`)}
              aria-expanded={statusOpen}
              aria-haspopup="listbox"
              title={presenceMeta.supportHint}
              disabled={busy}
              onClick={() => setStatusOpen((v) => !v)}
            >
              <span className={cn("dash-account-presence-dot", `is-${presence}`)} aria-hidden />
              <span>{presenceMeta.label}</span>
              <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
            </button>
            {statusMenu}
          </div>

          <Link
            href="/dashboard/account"
            onClick={onNavigate}
            className={cn(
              "dash-account-action",
              pathname === "/dashboard/account" && "is-active"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            Settings
          </Link>

          <button
            type="button"
            disabled={busy}
            onClick={() => void signOut()}
            className="dash-account-action is-danger"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
