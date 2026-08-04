"use client";

import { useEffect, useState } from "react";

const RETRY_KEY = "octivate:global-error-retry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    let attempts = 0;
    try {
      attempts = Number(sessionStorage.getItem(RETRY_KEY) || "0");
    } catch {
      attempts = 0;
    }

    if (attempts < 2) {
      try {
        sessionStorage.setItem(RETRY_KEY, String(attempts + 1));
      } catch {
        /* ignore */
      }
      const t = window.setTimeout(() => {
        window.location.reload();
      }, 400);
      return () => window.clearTimeout(t);
    }

    setShowActions(true);
  }, [error, reset]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#070b17",
          color: "#eef2ff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              opacity: 0.55,
            }}
          >
            {showActions ? "Recovery" : "Recovering"}
          </p>
          <h1 style={{ margin: "0.75rem 0 0.5rem", fontSize: 28, lineHeight: 1.2 }}>
            {showActions ? "Continue to Octivate" : "Restoring Octivate…"}
          </h1>
          <p style={{ margin: 0, opacity: 0.75, lineHeight: 1.5, fontSize: 15 }}>
            {showActions
              ? "The previous view failed to mount. Use a fresh entry point below."
              : "Automatically retrying a clean load."}
          </p>
          {showActions ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "center",
                marginTop: 22,
              }}
            >
              <a
                href="/dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 40,
                  padding: "0 16px",
                  borderRadius: 10,
                  background: "#8950ee",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 650,
                }}
              >
                Open workspace
              </a>
              <a
                href="/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 40,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#eef2ff",
                  textDecoration: "none",
                  fontWeight: 650,
                }}
              >
                Home
              </a>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.removeItem(RETRY_KEY);
                  } catch {
                    /* ignore */
                  }
                  window.location.reload();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 40,
                  padding: "0 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#eef2ff",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </body>
    </html>
  );
}
