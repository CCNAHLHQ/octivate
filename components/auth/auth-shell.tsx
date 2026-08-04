"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { AuthLogoWatermarks } from "@/components/auth/auth-logo-watermarks";
import { LoginTransition } from "@/components/auth/login-transition";
import { OctivateLogo } from "@/components/brand";
import type { PublicUser } from "@/lib/auth/types";

type Mode = "signin" | "signup";

type SigninView = "signin" | "forgot" | "reset";

type GeneratedCredentials = {
  username: string;
  password: string;
  email: string;
};

const COPY: Record<
  Mode,
  {
    kicker: string;
    title: string;
    lede: string;
    submit: string;
    switchText: string;
    switchHref: string;
    switchLabel: string;
    visualTitle: string;
    visualBody: string;
  }
> = {
  signin: {
    kicker: "Workspace access",
    title: "Sign in to Octivate",
    lede: "Use your Octivate email or username and password to open the decision-intelligence workspace.",
    submit: "Sign in",
    switchText: "Don't have an account?",
    switchHref: "/signup",
    switchLabel: "Sign up",
    visualTitle: "Clarity for Caribbean decisions",
    visualBody:
      "Connect scattered regional signals, test what can be trusted, and move with evidence-backed judgement.",
  },
  signup: {
    kicker: "Free tier",
    title: "Create your Octivate access",
    lede: "Use the same email/username and password fields as sign-in, or generate secure credentials when enabled.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchHref: "/signin",
    switchLabel: "Sign in",
    visualTitle: "Decision intelligence, ready to run",
    visualBody:
      "Structure the question, assemble evidence across Power–Systems–Narratives, and leave with options you can act on.",
  },
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function AuthShellInner({ mode }: { mode: Mode }) {
  const searchParams = useSearchParams();
  const copy = COPY[mode];
  const resetToken = searchParams.get("reset")?.trim() || "";

  const [signinView, setSigninView] = useState<SigninView>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState<"user" | "pass" | null>(null);
  const [transition, setTransition] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [existing, setExisting] = useState<PublicUser | null>(null);
  const [allowAutogenerate, setAllowAutogenerate] = useState<boolean | null>(null);
  const [autogenCredentials, setAutogenCredentials] = useState<GeneratedCredentials | null>(null);
  const [autogenRevealed, setAutogenRevealed] = useState(false);

  useEffect(() => {
    if (mode === "signin" && resetToken) {
      setSigninView("reset");
    }
  }, [mode, resetToken]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "include", headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((data: { user?: PublicUser | null }) => {
        if (!cancelled) setExisting(data.user || null);
      })
      .catch(() => {
        if (!cancelled) setExisting(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "signup") return;
    let cancelled = false;
    void fetch("/api/auth/signup-config", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((data: { allowAutogenerateAccounts?: boolean }) => {
        if (!cancelled) {
          setAllowAutogenerate(data.allowAutogenerateAccounts !== false);
        }
      })
      .catch(() => {
        if (!cancelled) setAllowAutogenerate(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  async function finishToDashboard(message?: string) {
    if (message) setStatus(message);
    setTransition(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLeaving(true);
    await new Promise((r) => setTimeout(r, 380));
    // Hard navigation avoids stale-chunk soft-nav failures after auth/deploy.
    window.location.assign("/dashboard");
  }

  async function previewCredentials() {
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preview: true }),
      });
      const data = (await res.json()) as {
        credentials?: { username: string; password: string; email?: string };
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not generate credentials");
        return;
      }
      if (data.credentials) {
        setEmail(data.credentials.email || data.credentials.username);
        setPassword(data.credentials.password);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    }
  }

  async function autogenerateAccount() {
    if (busy) return;
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ autogenerate: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        credentials?: GeneratedCredentials;
      };
      if (!res.ok) {
        setError(data.error || "Could not create account");
        setBusy(false);
        return;
      }
      if (data.credentials) {
        setAutogenCredentials(data.credentials);
        setAutogenRevealed(true);
        setEmail(data.credentials.email || data.credentials.username);
        setPassword(data.credentials.password);
      }
      setStatus(data.message || "Account created. Save your credentials — they are shown once.");
      setBusy(false);
    } catch {
      setError("Network error. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function onForgotSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not send reset email");
        setBusy(false);
        return;
      }
      setStatus(
        data.message ||
          "If an account exists for that email, password reset instructions have been sent."
      );
      setBusy(false);
    } catch {
      setError("Network error. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function onResetSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !resetToken) return;
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: resetToken, password: resetPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not reset password");
        setBusy(false);
        return;
      }
      await finishToDashboard(data.message || "Password updated. You are signed in.");
    } catch {
      setError("Network error. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setStatus("");
    if (mode === "signup" && allowAutogenerate) {
      return;
    }
    if (mode === "signup" && (!terms || !privacy)) {
      setError("Accept the Terms and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: email.trim(), password }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          retryAfterSec?: number;
        };
        if (!res.ok) {
          setError(
            data.error ||
              (res.status === 429
                ? `Too many attempts. Retry in ${data.retryAfterSec || 60}s.`
                : "Sign-in failed")
          );
          setBusy(false);
          return;
        }
        await finishToDashboard(data.message || "Signed in");
        return;
      }

      const username = email.includes("@")
        ? email.trim().split("@")[0]
        : email.trim();
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          acceptTerms: terms,
          acceptPrivacy: privacy,
          username,
          password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        credentials?: { username: string; password: string; email: string };
      };
      if (!res.ok) {
        setError(data.error || "Could not create account");
        setBusy(false);
        return;
      }
      if (data.credentials) {
        setEmail(data.credentials.email || data.credentials.username);
        setPassword(data.credentials.password);
      }
      await finishToDashboard(data.message || "Account created");
    } catch {
      setError("Network error. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function onCopy(kind: "user" | "pass", value: string) {
    const ok = await copyText(value);
    if (ok) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    }
  }

  const showAutogenSignup = mode === "signup" && allowAutogenerate === true;
  const signupLoading = mode === "signup" && allowAutogenerate === null;

  function renderSigninContent() {
    if (signinView === "forgot") {
      return (
        <div className="auth-recovery">
          <button
            type="button"
            className="auth-link auth-back-link"
            onClick={() => {
              setSigninView("signin");
              setError("");
              setStatus("");
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to sign in
          </button>
          <p className="auth-kicker">Password recovery</p>
          <h1 className="auth-title">Forgot password</h1>
          <p className="auth-lede">
            Enter the email on your account. If it exists, we will send reset instructions.
          </p>
          <form className="auth-form" onSubmit={onForgotSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="forgot-email">
                Email <span className="req">*</span>
              </label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@octivate.io"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="auth-status is-error" role="alert">
                {error}
              </p>
            ) : null}
            {status ? (
              <p className="auth-status is-ok" role="status">
                {status}
              </p>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={busy || !forgotEmail.trim().includes("@")}
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </div>
      );
    }

    if (signinView === "reset") {
      return (
        <div className="auth-recovery">
          <p className="auth-kicker">Password recovery</p>
          <h1 className="auth-title">Choose a new password</h1>
          <p className="auth-lede">
            Enter a new password for your account. You will be signed in when it succeeds.
          </p>
          <form className="auth-form" onSubmit={onResetSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="reset-password">
                New password <span className="req">*</span>
              </label>
              <div className="auth-pass-wrap">
                <input
                  id="reset-password"
                  name="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 10 characters"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  minLength={10}
                />
                <button
                  type="button"
                  className="auth-pass-toggle"
                  aria-label={showPass ? "Hide password" : "Show password"}
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            {error ? (
              <p className="auth-status is-error" role="alert">
                {error}
              </p>
            ) : null}
            {status ? (
              <p className="auth-status is-ok" role="status">
                {status}
              </p>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={busy || resetPassword.length < 10}
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      );
    }

    return (
      <>
        <p className="auth-kicker">{copy.kicker}</p>
        <h1 className="auth-title">{copy.title}</h1>
        <p className="auth-lede">{copy.lede}</p>
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor={`${mode}-email`}>
              Email or username <span className="req">*</span>
            </label>
            <input
              id={`${mode}-email`}
              name="email"
              type="text"
              autoComplete="username"
              placeholder="you@octivate.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor={`${mode}-password`}>
              Password <span className="req">*</span>
            </label>
            <div className="auth-pass-wrap">
              <input
                id={`${mode}-password`}
                name="password"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-pass-toggle"
                aria-label={showPass ? "Hide password" : "Show password"}
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <div className="auth-row">
            <span />
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setSigninView("forgot");
                setForgotEmail(email.includes("@") ? email.trim() : "");
                setError("");
                setStatus("");
              }}
            >
              Forgot password?
            </button>
          </div>

          {error ? (
            <p className="auth-status is-error" role="alert">
              {error}
            </p>
          ) : null}
          {status ? (
            <p className="auth-status is-ok" role="status">
              {status}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={busy || !email.trim() || !password}
          >
            {busy ? "Working…" : copy.submit}
          </button>
        </form>
      </>
    );
  }

  function renderSignupContent() {
    if (signupLoading) {
      return (
        <>
          <p className="auth-kicker">{copy.kicker}</p>
          <h1 className="auth-title">{copy.title}</h1>
          <p className="auth-lede text-faint">Loading signup options…</p>
        </>
      );
    }

    if (showAutogenSignup) {
      return (
        <>
          <p className="auth-kicker">{copy.kicker}</p>
          <h1 className="auth-title">{copy.title}</h1>
          <p className="auth-lede">
            One-click provisioning is enabled. Generate secure credentials — they are shown once
            before you enter the workspace.
          </p>

          {autogenRevealed && autogenCredentials ? (
            <div className="auth-autogen-reveal" role="status">
              <p className="auth-autogen-reveal-title">Save these credentials</p>
              <div className="auth-field">
                <label>Username / email</label>
                <div className="auth-pass-wrap">
                  <input
                    type="text"
                    readOnly
                    value={autogenCredentials.email || autogenCredentials.username}
                  />
                  <button
                    type="button"
                    className="auth-pass-toggle"
                    aria-label="Copy username"
                    onClick={() =>
                      void onCopy(
                        "user",
                        autogenCredentials.email || autogenCredentials.username
                      )
                    }
                  >
                    {copied === "user" ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
              <div className="auth-field">
                <label>Password</label>
                <div className="auth-pass-wrap">
                  <input type="text" readOnly value={autogenCredentials.password} />
                  <button
                    type="button"
                    className="auth-pass-toggle"
                    aria-label="Copy password"
                    onClick={() => void onCopy("pass", autogenCredentials.password)}
                  >
                    {copied === "pass" ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="auth-status is-error" role="alert">
              {error}
            </p>
          ) : null}
          {status ? (
            <p className="auth-status is-ok" role="status">
              {status}
            </p>
          ) : null}

          {autogenRevealed ? (
            <button
              type="button"
              className="btn btn-primary auth-submit"
              disabled={busy}
              onClick={() => void finishToDashboard()}
            >
              Continue to workspace
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary auth-submit"
              disabled={busy}
              onClick={() => void autogenerateAccount()}
            >
              {busy ? "Creating…" : "Generate secure credentials"}
            </button>
          )}
        </>
      );
    }

    return (
      <>
        <p className="auth-kicker">{copy.kicker}</p>
        <h1 className="auth-title">{copy.title}</h1>
        <p className="auth-lede">{copy.lede}</p>
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor={`${mode}-email`}>
              Email or username <span className="req">*</span>
            </label>
            <div className="auth-pass-wrap">
              <input
                id={`${mode}-email`}
                name="email"
                type="text"
                autoComplete="username"
                placeholder="you@octivate.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-pass-toggle"
                aria-label="Copy username"
                disabled={!email}
                onClick={() => void onCopy("user", email)}
              >
                {copied === "user" ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor={`${mode}-password`}>
              Password <span className="req">*</span>
            </label>
            <div className="auth-pass-wrap">
              <input
                id={`${mode}-password`}
                name="password"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Choose a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
              />
              <button
                type="button"
                className="auth-pass-toggle"
                aria-label={showPass ? "Hide password" : "Show password"}
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
              <button
                type="button"
                className="auth-pass-toggle auth-pass-toggle-secondary"
                aria-label="Copy password"
                disabled={!password}
                onClick={() => void onCopy("pass", password)}
              >
                {copied === "pass" ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm auth-generate"
            onClick={() => void previewCredentials()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Generate secure credentials
          </button>

          <div className="auth-checks">
            <label className="auth-check">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                required
              />
              <span>
                I agree to the{" "}
                <a className="auth-link" href="mailto:info@censii.co?subject=Terms">
                  Terms &amp; Conditions
                </a>
              </span>
            </label>
            <label className="auth-check">
              <input
                type="checkbox"
                checked={privacy}
                onChange={(e) => setPrivacy(e.target.checked)}
                required
              />
              <span>
                I agree to the{" "}
                <a className="auth-link" href="mailto:info@censii.co?subject=Privacy">
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>

          {error ? (
            <p className="auth-status is-error" role="alert">
              {error}
            </p>
          ) : null}
          {status ? (
            <p className="auth-status is-ok" role="status">
              {status}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={
              busy || !email.trim() || !password || !terms || !privacy
            }
          >
            {busy ? "Working…" : copy.submit}
          </button>
        </form>
      </>
    );
  }

  const showSwitch =
    mode === "signin"
      ? signinView === "signin"
      : !signupLoading;

  return (
    <>
      <div className="auth-root">
        <div className="auth-ambient" aria-hidden="true" />

        <div className="auth-shell">
          <section className="auth-panel">
            <div className="auth-panel-inner">
              <div className="auth-brand-row">
                <OctivateLogo variant="lockup" height={36} />
              </div>

              <div className="auth-card">
                <div className="auth-card-glint" aria-hidden />

                {existing ? (
                  <div className="auth-signed-in" role="status">
                    <div className="auth-signed-in-main">
                      <UserRound className="h-4 w-4 shrink-0" aria-hidden />
                      <div className="auth-signed-in-copy">
                        <p className="auth-signed-in-title">Already signed in</p>
                        <p className="auth-signed-in-meta">
                          {existing.displayName} · {existing.email} · {existing.role}
                        </p>
                      </div>
                    </div>
                    <a className="btn btn-primary btn-sm auth-signed-in-action" href="/dashboard">
                      Open workspace
                    </a>
                  </div>
                ) : null}

                {mode === "signin" ? renderSigninContent() : renderSignupContent()}

                {showSwitch ? (
                  <>
                    <div className="auth-divider">Or</div>
                    <p className="auth-switch">
                      {copy.switchText}{" "}
                      <Link className="auth-link" href={copy.switchHref}>
                        {copy.switchLabel}
                      </Link>
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="auth-visual" aria-hidden="true">
            <AuthLogoWatermarks />
            <div className="auth-visual-copy">
              <strong>{copy.visualTitle}</strong>
              <p>{copy.visualBody}</p>
            </div>
          </aside>
        </div>
      </div>

      <LoginTransition active={transition} leaving={leaving} />
    </>
  );
}

export function AuthShell({ mode }: { mode: Mode }) {
  return (
    <Suspense
      fallback={
        <div className="auth-root">
          <div className="auth-ambient" aria-hidden="true" />
          <div className="auth-shell">
            <section className="auth-panel">
              <div className="auth-panel-inner">
                <p className="auth-lede text-faint">Loading…</p>
              </div>
            </section>
          </div>
        </div>
      }
    >
      <AuthShellInner mode={mode} />
    </Suspense>
  );
}
