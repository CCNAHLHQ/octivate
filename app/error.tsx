"use client";

import { useEffect, useState } from "react";

const RETRY_KEY = "octivate:route-error-retry";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(true);

  useEffect(() => {
    const key = `${RETRY_KEY}:${error.digest || error.message.slice(0, 80)}`;
    let attempts = 0;
    try {
      attempts = Number(sessionStorage.getItem(key) || "0");
    } catch {
      attempts = 0;
    }

    if (attempts < 1) {
      try {
        sessionStorage.setItem(key, String(attempts + 1));
      } catch {
        /* ignore */
      }
      const t = window.setTimeout(() => {
        window.location.reload();
      }, 350);
      return () => window.clearTimeout(t);
    }

    if (attempts < 2) {
      try {
        sessionStorage.setItem(key, String(attempts + 1));
      } catch {
        /* ignore */
      }
      const t = window.setTimeout(() => {
        try {
          reset();
        } catch {
          window.location.assign("/dashboard");
        }
      }, 350);
      return () => window.clearTimeout(t);
    }

    setRecovering(false);
  }, [error, reset]);

  if (recovering) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-6 py-16 text-center">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            Recovering
          </p>
          <p className="mt-2 text-sm text-mist">Restoring your workspace…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-[60vh] place-items-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          Temporary interruption
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-foam">
          Taking you back to a working view
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-mist">
          Something failed while rendering this route. Continue into the workspace
          or return home — no stuck reload loop.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a className="btn btn-primary btn-sm justify-center" href="/dashboard">
            Open workspace
          </a>
          <a className="btn btn-ghost btn-sm justify-center" href="/">
            Home
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-sm justify-center"
            onClick={() => {
              try {
                sessionStorage.removeItem(
                  `${RETRY_KEY}:${error.digest || error.message.slice(0, 80)}`
                );
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
