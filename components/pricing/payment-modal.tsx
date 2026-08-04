"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { ArrowLeft, Check, CreditCard, Lock, Wallet, X } from "lucide-react";
import {
  type BillingInterval,
  type CheckoutContext,
  type PaymentMethodId,
  type PlanDefinition,
  PAYMENT_METHODS,
  formatMoney,
  getPlan,
  resolvePrice,
} from "@/lib/billing/plans";

type Step = "method" | "details" | "done";

type PaymentModalProps = {
  open: boolean;
  context: CheckoutContext | null;
  onClose: () => void;
  /** Live catalogue from operator pricing store (falls back to seeded PLANS). */
  plans?: PlanDefinition[];
  /** Optional: swap interval from inside the modal (e.g. team monthly/annual) */
  onIntervalChange?: (interval: BillingInterval) => void;
};

function MethodPanel({
  methodId,
  amountLabel,
  onSubmit,
  busy,
}: {
  methodId: PaymentMethodId;
  amountLabel: string;
  onSubmit: (payload: Record<string, string>) => void;
  busy: boolean;
}) {
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [email, setEmail] = useState("");
  const [asset, setAsset] = useState<"btc" | "eth">("btc");
  const [wallet, setWallet] = useState("");

  function handle(e: FormEvent) {
    e.preventDefault();
    if (methodId === "card") {
      onSubmit({ email, cardName, cardNumber, expiry, cvc });
      return;
    }
    if (methodId === "crypto") {
      onSubmit({ email, asset, wallet });
      return;
    }
    onSubmit({ email });
  }

  if (methodId === "stripe") {
    return (
      <form className="pay-form" onSubmit={handle}>
        <p className="pay-form-lede">
          Continue to Stripe to complete <strong>{amountLabel}</strong>. You&apos;ll be redirected
          when live billing is connected.
        </p>
        <label className="pay-field">
          <span>Receipt email</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@organisation.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <button type="submit" className="btn btn-primary glimmer-btn pay-submit" disabled={busy}>
          <Lock className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Preparing…" : "Continue with Stripe"}
        </button>
      </form>
    );
  }

  if (methodId === "paypal") {
    return (
      <form className="pay-form" onSubmit={handle}>
        <p className="pay-form-lede">
          Pay <strong>{amountLabel}</strong> with PayPal. Account linking will open in a secure
          window when billing is live.
        </p>
        <label className="pay-field">
          <span>PayPal email</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="name@paypal.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <button type="submit" className="btn btn-primary glimmer-btn pay-submit" disabled={busy}>
          <Wallet className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Preparing…" : "Continue with PayPal"}
        </button>
      </form>
    );
  }

  if (methodId === "card") {
    return (
      <form className="pay-form" onSubmit={handle}>
        <p className="pay-form-lede">
          Card details stay on this device for now — no charge is processed until the card provider
          is wired.
        </p>
        <label className="pay-field">
          <span>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="pay-field">
          <span>Name on card</span>
          <input
            type="text"
            required
            autoComplete="cc-name"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="pay-field">
          <span>Card number</span>
          <input
            type="text"
            required
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            disabled={busy}
          />
        </label>
        <div className="pay-field-row">
          <label className="pay-field">
            <span>Expiry</span>
            <input
              type="text"
              required
              autoComplete="cc-exp"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="pay-field">
            <span>CVC</span>
            <input
              type="text"
              required
              autoComplete="cc-csc"
              placeholder="123"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>
        <div className="pay-card-brands" aria-hidden="true">
          <Image src="/payments/visa.svg" alt="" width={40} height={14} unoptimized />
          <Image src="/payments/mastercard.svg" alt="" width={32} height={20} unoptimized />
        </div>
        <button type="submit" className="btn btn-primary glimmer-btn pay-submit" disabled={busy}>
          <CreditCard className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Preparing…" : `Pay ${amountLabel}`}
        </button>
      </form>
    );
  }

  // crypto
  return (
    <form className="pay-form" onSubmit={handle}>
      <p className="pay-form-lede">
        Send <strong>{amountLabel}</strong> in crypto. Address generation will attach when the
        processor is connected.
      </p>
      <label className="pay-field">
        <span>Email for receipt</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
      </label>
      <div className="pay-asset-toggle" role="group" aria-label="Asset">
        <button
          type="button"
          className={asset === "btc" ? "is-on" : ""}
          onClick={() => setAsset("btc")}
        >
          <Image src="/payments/bitcoin.svg" alt="" width={16} height={16} unoptimized />
          Bitcoin
        </button>
        <button
          type="button"
          className={asset === "eth" ? "is-on" : ""}
          onClick={() => setAsset("eth")}
        >
          <Image src="/payments/ethereum.svg" alt="" width={14} height={16} unoptimized />
          Ethereum
        </button>
      </div>
      <label className="pay-field">
        <span>Refund wallet <em>(optional)</em></span>
        <input
          type="text"
          placeholder="Your wallet address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          disabled={busy}
        />
      </label>
      <button type="submit" className="btn btn-primary glimmer-btn pay-submit" disabled={busy}>
        {busy ? "Preparing…" : `Continue with ${asset === "btc" ? "Bitcoin" : "Ethereum"}`}
      </button>
    </form>
  );
}

export function PaymentModal({
  open,
  context,
  onClose,
  plans,
  onIntervalChange,
}: PaymentModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("method");
  const [methodId, setMethodId] = useState<PaymentMethodId | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastPayload, setLastPayload] = useState<Record<string, string> | null>(null);

  const plan = useMemo(() => {
    if (!context) return null;
    return plans?.find((p) => p.id === context.planId) ?? getPlan(context.planId);
  }, [context, plans]);

  const price = useMemo(() => {
    if (!plan || !context) return null;
    return resolvePrice(plan, context.interval);
  }, [plan, context]);

  const amountLabel = price ? formatMoney(price.amount, price.currency) : "";

  const reset = useCallback(() => {
    const preset = context?.methodId ?? null;
    setMethodId(preset);
    setStep(preset ? "details" : "method");
    setBusy(false);
    setLastPayload(null);
  }, [context?.methodId]);

  useEffect(() => {
    if (open) reset();
  }, [open, context?.planId, context?.interval, reset]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("button, input")?.focus();
    }, 40);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open || !context || !plan || !price) return null;

  const methods = PAYMENT_METHODS.filter((m) => m.enabled);
  const activeMethod = methods.find((m) => m.id === methodId) ?? null;

  async function complete(payload: Record<string, string>) {
    setBusy(true);
    setLastPayload(payload);
    // Extensibility hook: future fetch("/api/billing/checkout", { body: { ...context, methodId, payload } })
    await new Promise((r) => setTimeout(r, 650));
    setBusy(false);
    setStep("done");
  }

  return (
    <div className="pay-modal-root" role="presentation">
      <button type="button" className="pay-modal-backdrop" aria-label="Close checkout" onClick={onClose} />
      <div
        ref={panelRef}
        className="pay-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button type="button" className="pay-modal-close" aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>

        <header className="pay-modal-head">
          <p className="pay-modal-kicker">Checkout</p>
          <h2 id={titleId}>{plan.name}</h2>
          <p className="pay-modal-amount">
            {amountLabel}
            {price.unitLabel ? <span> {price.unitLabel}</span> : null}
          </p>
          {plan.intervals.length > 1 && onIntervalChange && (
            <div className="billing-toggle pay-modal-billing" role="group" aria-label="Billing period">
              {plan.intervals.map((iv) => (
                <button
                  key={iv}
                  type="button"
                  className={context.interval === iv ? "is-on" : ""}
                  aria-pressed={context.interval === iv}
                  onClick={() => onIntervalChange(iv)}
                >
                  {iv === "monthly" ? "Monthly" : iv === "annual" ? "Annual" : "One-time"}
                </button>
              ))}
            </div>
          )}
        </header>

        {step === "method" && (
          <div className="pay-method-grid">
            <p className="pay-step-label">Choose how to pay</p>
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                className="pay-method-card"
                onClick={() => {
                  setMethodId(m.id);
                  setStep("details");
                }}
              >
                <span className={`pay-logo ${m.logoTone === "brand" ? "is-brand" : ""}`}>
                  <Image src={m.logoSrc} alt="" width={m.logoW} height={m.logoH} unoptimized />
                </span>
                <span className="pay-method-copy">
                  <b>{m.label}</b>
                  <small>{m.description}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {step === "details" && activeMethod && (
          <div className="pay-details">
            <button
              type="button"
              className="pay-back"
              onClick={() => {
                setStep("method");
                setMethodId(null);
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Other methods
            </button>
            <div className="pay-details-head">
              <span className={`pay-logo ${activeMethod.logoTone === "brand" ? "is-brand" : ""}`}>
                <Image
                  src={activeMethod.logoSrc}
                  alt={activeMethod.logoAlt}
                  width={activeMethod.logoW}
                  height={activeMethod.logoH}
                  unoptimized
                />
              </span>
              <div>
                <b>{activeMethod.label}</b>
                <small>{activeMethod.description}</small>
              </div>
            </div>
            <MethodPanel
              methodId={activeMethod.id}
              amountLabel={amountLabel}
              busy={busy}
              onSubmit={(payload) => void complete(payload)}
            />
          </div>
        )}

        {step === "done" && (
          <div className="pay-done">
            <span className="pay-done-icon" aria-hidden>
              <Check className="h-5 w-5" />
            </span>
            <h3>Demo checkout — no charge</h3>
            <p>
              {plan.name} · {amountLabel}
              {activeMethod ? ` · ${activeMethod.label}` : ""}
            </p>
            <p className="pay-done-fine">
              No charge was made. When providers go live, this step will create a real session using
              the same plan / method / extras context
              {lastPayload?.email ? ` for ${lastPayload.email}` : ""}.
            </p>
            <button type="button" className="btn btn-primary glimmer-btn" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
