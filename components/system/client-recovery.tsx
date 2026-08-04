"use client";

import { useEffect } from "react";

const RELOAD_KEY = "octivate:client-recovery-reload";
const RELOAD_WINDOW_MS = 15_000;

function isRecoverableLoadError(input: unknown): boolean {
  const msg =
    input instanceof Error
      ? `${input.name} ${input.message}`
      : typeof input === "string"
        ? input
        : input && typeof input === "object" && "message" in input
          ? String((input as { message?: unknown }).message || "")
          : String(input || "");

  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|Unexpected token '<'|CSS_CHUNK_LOAD_FAILED|Loading CSS chunk/i.test(
    msg
  );
}

function softReloadOnce() {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    const last = raw ? Number(raw) : 0;
    if (Number.isFinite(last) && Date.now() - last < RELOAD_WINDOW_MS) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* private mode — still attempt recovery */
  }
  window.location.reload();
}

/**
 * Recovers from stale-deploy / missing-chunk failures that otherwise leave
 * the shell on a dead "couldn't load" screen after rebuilds or soft navigations.
 */
export function ClientRecovery() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      if (isRecoverableLoadError(event.error) || isRecoverableLoadError(event.message)) {
        event.preventDefault();
        softReloadOnce();
      }
    }

    function onRejection(event: PromiseRejectionEvent) {
      if (isRecoverableLoadError(event.reason)) {
        event.preventDefault();
        softReloadOnce();
      }
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
