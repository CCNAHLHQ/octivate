"use client";

import { FormEvent, useId, useState } from "react";
import { Check, Mail, Shield, Sparkles, XCircle } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";

type Status = "idle" | "loading" | "success" | "unsubscribed" | "error";

export const MAILING_SUBSCRIBED_KEY = "octivate-mail-subscribed";

export function MailingListCopy({
  titleId,
  descId,
}: {
  titleId?: string;
  descId?: string;
}) {
  const t = useT();
  return (
    <div className="mailing-copy">
      <span className="eyebrow">{t("mailing.eyebrow")}</span>
      <h2 id={titleId}>{t("mailing.title")}</h2>
      <p className="mailing-lede" id={descId}>
        {t("mailing.lede")}
      </p>
      <ul className="mailing-benefits">
        <li>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {t("mailing.benefit.updates")}
        </li>
        <li>
          <Mail className="h-3.5 w-3.5" aria-hidden />
          {t("mailing.benefit.notes")}
        </li>
        <li>
          <Shield className="h-3.5 w-3.5" aria-hidden />
          {t("mailing.benefit.unsubscribe")}
        </li>
      </ul>
    </div>
  );
}

export function MailingListForm({ idPrefix = "mailing" }: { idPrefix?: string }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(action: "subscribe" | "unsubscribe") {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/mailing-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          action,
          consent: action === "subscribe" ? consent : undefined,
          website: honeypot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const err = data.error || t("mailing.genericError");
        setStatus("error");
        setMessage(err);
        toast.error(err);
        return;
      }
      if (action === "unsubscribe") {
        const msg = t("mailing.unsubscribed");
        setStatus("unsubscribed");
        setMessage(msg);
        toast.success(msg);
        return;
      }
      const msg = t("mailing.success");
      setStatus("success");
      setMessage(msg);
      toast.success(msg);
      setConsent(false);
      try {
        localStorage.setItem(MAILING_SUBSCRIBED_KEY, "1");
      } catch {
        /* ignore */
      }
    } catch {
      const err = t("mailing.networkError");
      setStatus("error");
      setMessage(err);
      toast.error(err);
    }
  }

  function onSubscribe(e: FormEvent) {
    e.preventDefault();
    if (!consent) {
      setStatus("error");
      setMessage(t("mailing.consentRequired"));
      return;
    }
    void submit("subscribe");
  }

  return (
    <form className="mailing-form" onSubmit={onSubscribe} noValidate>
      <label className="mailing-field" htmlFor={`${idPrefix}-email`}>
        <span>{t("mailing.email")}</span>
        <input
          id={`${idPrefix}-email`}
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder={t("mailing.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
        />
      </label>
      <label className="mailing-field" htmlFor={`${idPrefix}-name`}>
        <span>
          {t("mailing.name")} <em>{t("mailing.nameOptional")}</em>
        </span>
        <input
          id={`${idPrefix}-name`}
          type="text"
          name="name"
          autoComplete="name"
          placeholder={t("mailing.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={status === "loading"}
        />
      </label>

      <label className="mailing-hp" aria-hidden="true">
        Website
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </label>

      <label className="mailing-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={status === "loading"}
        />
        <span>{t("mailing.consent")}</span>
      </label>

      <div className="mailing-actions">
        <button
          type="submit"
          className="btn btn-primary mailing-btn glimmer-btn"
          disabled={status === "loading" || !email}
        >
          {status === "loading" ? t("mailing.saving") : t("mailing.join")}
          <span className="arrow">→</span>
        </button>
        <button
          type="button"
          className="btn btn-ghost mailing-btn-ghost"
          disabled={status === "loading" || !email}
          onClick={() => void submit("unsubscribe")}
        >
          {t("mailing.optOut")}
        </button>
      </div>

      {message && (
        <p
          className={`mailing-status ${
            status === "error" ? "is-error" : status === "unsubscribed" ? "is-muted" : "is-ok"
          }`}
          role="status"
        >
          {status === "success" && <Check className="h-3.5 w-3.5" aria-hidden />}
          {status === "error" && <XCircle className="h-3.5 w-3.5" aria-hidden />}
          {message}
        </p>
      )}

      <p className="mailing-fine">{t("mailing.fine")}</p>
    </form>
  );
}

/** Inline mailing list — rendered in page HTML immediately (no modal delay). */
export function MailingListSection() {
  const titleId = useId();
  const descId = useId();

  return (
    <section className="section mailing-inline-section" id="mailing" aria-labelledby={titleId}>
      <div className="container">
        <div className="mailing-inline-panel">
          <div className="mailing-glow" aria-hidden="true" />
          <div className="mailing-region">
            <MailingListCopy titleId={titleId} descId={descId} />
            <MailingListForm idPrefix="mailing-inline" />
          </div>
        </div>
      </div>
    </section>
  );
}
