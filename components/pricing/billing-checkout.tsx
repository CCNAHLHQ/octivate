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
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgePercent,
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  Lock,
  Plus,
  ShoppingBag,
  TicketPercent,
  UserRound,
  X,
} from "lucide-react";
import {
  type CheckoutContext,
  type PaymentMethodId,
  type PlanDefinition,
  PAYMENT_METHODS,
  formatMoney,
  getPlan,
  resolvePrice,
} from "@/lib/billing/plans";
import {
  type ApplyPromoOk,
  applyPromo,
  listAvailablePromos,
  normalizePromoCode,
} from "@/lib/billing/promos";
import { BILLING_COUNTRIES } from "@/lib/billing/countries";
import {
  loadBillingDraft,
  saveBillingDraft,
} from "@/lib/billing/billing-draft";
import {
  analyzeCardNumber,
  analyzeCvv,
  analyzeExpiry,
  formatCardNumber,
  formatExpiryInput,
  validateCardCheckout,
} from "@/lib/billing/card-validation";
import { collectCheckoutClientContext } from "@/lib/billing/client-context";
import { CountryFlag } from "@/components/billing/country-flag";
import { CardBrandMark } from "@/components/billing/card-brand-mark";
import { BrandLogoLoading } from "@/components/ui/brand-logo-loading";
import { SmoothSelect } from "@/components/ui/smooth-select";
import { ConfettiBurst } from "@/components/ui/confetti-burst";
import { PaymentMethodMark } from "@/components/pricing/payment-method-marks";
import { cn } from "@/lib/utils";

type Step = "details" | "submitting" | "done";

type BillingCheckoutProps = {
  open: boolean;
  context: CheckoutContext | null;
  onClose: () => void;
  plans?: PlanDefinition[];
};

const METHODS = PAYMENT_METHODS.filter((m) => m.enabled && m.id !== "crypto");

const CRYPTO_OPTS = [
  { value: "btc", label: "Bitcoin (BTC)" },
  { value: "eth", label: "Ethereum (ETH)" },
  { value: "usdt", label: "Tether (USDT)" },
  { value: "usdc", label: "USD Coin (USDC)" },
];

const panelEase = [0.22, 1, 0.36, 1] as const;

export function BillingCheckout({
  open,
  context,
  onClose,
  plans,
}: BillingCheckoutProps) {
  const titleId = useId();
  const agreeId = useId();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState<Step>("details");
  const [accountType, setAccountType] = useState<"individual" | "company">(
    "individual"
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [activeEmail, setActiveEmail] = useState("");
  const [addEmailOpen, setAddEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [methodId, setMethodId] = useState<PaymentMethodId>("card");
  const [cardDetailsOpen, setCardDetailsOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cryptoAsset, setCryptoAsset] = useState("btc");
  const [walletAddress, setWalletAddress] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confettiKey, setConfettiKey] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<ApplyPromoOk | null>(null);
  const [offersOpen, setOffersOpen] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const hydrated = useRef(false);

  const plan = useMemo(() => {
    if (!context) return null;
    return plans?.find((p) => p.id === context.planId) || getPlan(context.planId);
  }, [context, plans]);

  const price = useMemo(() => {
    if (!plan || !context) return null;
    return resolvePrice(plan, context.interval);
  }, [plan, context]);

  const countryOptions = useMemo(
    () => [
      { value: "", label: "Select country" },
      ...BILLING_COUNTRIES.map((c) => ({
        value: c.code,
        label: c.name,
        prefix: <CountryFlag code={c.code} className="smooth-select-flag-img" />,
      })),
    ],
    []
  );

  const emailOptions = useMemo(() => {
    if (!emails.length) return [{ value: "", label: "Add an email" }];
    return emails.map((em) => ({ value: em, label: em }));
  }, [emails]);

  const cardAnalysis = useMemo(
    () => analyzeCardNumber(cardNumber),
    [cardNumber]
  );
  const expiryAnalysis = useMemo(() => analyzeExpiry(expiry), [expiry]);
  const cvvAnalysis = useMemo(
    () => analyzeCvv(cvc, cardAnalysis.codeSize),
    [cvc, cardAnalysis.codeSize]
  );

  useEffect(() => setMounted(true), []);

  /* Hydrate draft once on mount */
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const draft = loadBillingDraft();
    if (!draft) return;
    setAccountType(draft.accountType || "individual");
    setFirstName(draft.firstName || "");
    setLastName(draft.lastName || "");
    setCompanyName(draft.companyName || "");
    setCountry(draft.country || "");
    setStreet(draft.street || "");
    setCity(draft.city || "");
    setPostalCode(draft.postalCode || "");
    setEmails(Array.isArray(draft.emails) ? draft.emails : []);
    setActiveEmail(draft.activeEmail || "");
    if (draft.methodId && METHODS.some((m) => m.id === draft.methodId)) {
      setMethodId(draft.methodId);
    }
    setCardName(draft.cardName || "");
    setCardNumber(draft.cardNumber ? formatCardNumber(draft.cardNumber) : "");
    setExpiry(draft.expiry ? formatExpiryInput(draft.expiry) : "");
    setCryptoAsset(draft.cryptoAsset || "btc");
    setWalletAddress(draft.walletAddress || "");
    setAgreed(Boolean(draft.agreed));
    if (draft.cardNumber) setCardDetailsOpen(true);
  }, []);

  /* Persist draft (never store CVC) */
  useEffect(() => {
    if (!hydrated.current) return;
    const t = window.setTimeout(() => {
      saveBillingDraft({
        accountType,
        firstName,
        lastName,
        companyName,
        country,
        street,
        city,
        postalCode,
        emails,
        activeEmail,
        methodId,
        cardName,
        cardNumber,
        expiry,
        cryptoAsset,
        walletAddress,
        agreed,
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [
    accountType,
    firstName,
    lastName,
    companyName,
    country,
    street,
    city,
    postalCode,
    emails,
    activeEmail,
    methodId,
    cardName,
    cardNumber,
    expiry,
    cryptoAsset,
    walletAddress,
    agreed,
  ]);

  useEffect(() => {
    if (!open || !context) return;
    setStep("details");
    const raw = context.methodId;
    const mid: PaymentMethodId =
      raw === "stripe"
        ? "card"
        : raw === "crypto"
          ? "oxapay"
          : raw || methodId || "card";
    const resolved =
      METHODS.some((m) => m.id === mid) ? mid : ("card" as PaymentMethodId);
    setMethodId(resolved);
    setErrors({});
    setSubmitError(null);
    setOrderId(null);
    setConfettiKey(null);
    setAddEmailOpen(false);
    setOffersOpen(false);
    setPromoError(null);
    setPromoBusy(false);
    setAppliedPromo(null);
    setPromoInput("");
  }, [open, context]); // eslint-disable-line react-hooks/exhaustive-deps -- don't reset draft fields on reopen

  useEffect(() => {
    if (methodId !== "card") setCardDetailsOpen(false);
  }, [methodId]);

  const requestClose = useCallback(() => {
    setLeaving((already) => {
      if (already) return already;
      setVisible(false);
      setAddEmailOpen(false);
      setOffersOpen(false);
      window.setTimeout(() => {
        setLeaving(false);
        onClose();
      }, 160);
      return true;
    });
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setLeaving(false);
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open && !leaving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (offersOpen) setOffersOpen(false);
        else if (addEmailOpen) setAddEmailOpen(false);
        else requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, leaving, requestClose, addEmailOpen, offersOpen]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "Enter your first name.";
    if (!lastName.trim()) next.lastName = "Enter your last name.";
    if (accountType === "company" && !companyName.trim()) {
      next.companyName = "Enter your company name.";
    }
    if (!country) next.country = "Select your country of residence.";
    if (!street.trim()) next.street = "Enter your street address.";
    if (!city.trim()) next.city = "Enter a city or town.";
    if (!postalCode.trim()) next.postalCode = "Enter a postal code.";
    const primary = activeEmail || emails[0] || "";
    if (!primary || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primary)) {
      next.email = "Add a valid billing notification email.";
    }
    if (methodId === "card") {
      if (!cardDetailsOpen) {
        next.card = "Open card details to enter your card.";
      } else {
        const cardGate = validateCardCheckout({
          cardName,
          cardNumber,
          expiry,
          cvc,
        });
        if (!cardGate.ok) next.card = cardGate.error;
      }
    }
    if (!agreed) next.agreed = "Confirm the service agreement to continue.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!context || !plan || !price) return;
    if (!validate()) return;
    setStep("submitting");
    setSubmitError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          firstName,
          lastName,
          companyName,
          country,
          street,
          city,
          postalCode,
          emails: emails.length ? emails : [activeEmail].filter(Boolean),
          paymentMethodId: methodId,
          planId: context.planId,
          interval: context.interval,
          agreementAccepted: agreed,
          cardName,
          cardNumber: cardAnalysis.digits,
          cardBrand: cardAnalysis.brand,
          cardNiceType: cardAnalysis.niceType,
          expiry,
          cvc: cvvAnalysis.digits,
          cryptoAsset,
          walletAddress,
          clientContext: collectCheckoutClientContext(),
          promoCode: appliedPromo?.code || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      const id = data.order?.id || null;
      setOrderId(id);
      setStep("done");
      setConfettiKey(id || `ok-${Date.now()}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Checkout failed");
      setStep("details");
    }
  }

  async function applyPromoCode(raw?: string) {
    if (!context || !price) return;
    const code = normalizePromoCode(raw ?? promoInput);
    if (!code) {
      setPromoError("Enter a promo code");
      return;
    }
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/billing/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          planId: context.planId,
          interval: context.interval,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Invalid promo code");
      const promo = data.promo as ApplyPromoOk;
      setAppliedPromo(promo);
      setPromoInput(promo.code);
      setOffersOpen(false);
      setConfettiKey(`promo-${promo.code}-${Date.now()}`);
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Invalid promo code");
    } finally {
      setPromoBusy(false);
    }
  }

  function clearPromo() {
    setAppliedPromo(null);
    setPromoError(null);
    setPromoInput("");
  }

  function addEmail() {
    const v = newEmail.trim().toLowerCase();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmails((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setActiveEmail(v);
    setNewEmail("");
    setEmailError(null);
    setAddEmailOpen(false);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.email;
      return next;
    });
  }

  if (!mounted || (!open && !leaving) || !context || !plan || !price) return null;

  const payableAmount = appliedPromo?.payable ?? price.amount;
  const amountLabel = `${formatMoney(payableAmount)}${
    price.unitLabel ? ` ${price.unitLabel}` : ""
  }`;
  const availableOffers = listAvailablePromos(
    context.planId,
    context.interval
  ).map((p) => {
    const preview = applyPromo({
      code: p.code,
      planId: context.planId,
      interval: context.interval,
      listAmount: price.amount,
    });
    return {
      ...p,
      saveLabel: preview.ok
        ? preview.saveLabel
        : `Save ${formatMoney(p.amount)}`,
      discount: preview.ok ? preview.discount : p.amount,
    };
  });

  return createPortal(
    <>
      <ConfettiBurst fireKey={confettiKey} className="bill-confetti" />
      <div
        className={cn(
          "bill-root",
          visible && !leaving && "is-open",
          leaving && "is-leaving",
          (addEmailOpen || offersOpen) && "has-nested"
        )}
        role="presentation"
      >
        <button
          type="button"
          className="bill-backdrop"
          aria-label="Close billing"
          onClick={requestClose}
        />
        <motion.div
          className="bill-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-hidden={addEmailOpen || offersOpen || undefined}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: panelEase }}
        >
          <header className="bill-head">
            <div className="bill-head-copy">
              <p className="bill-kicker">Secure checkout</p>
              <h2 id={titleId}>Billing details</h2>
              <p className="bill-sub">
                <span className="bill-sub-plan">{plan.name}</span>
                <span className="bill-sub-dot" aria-hidden>
                  ·
                </span>
                {appliedPromo ? (
                  <span className="bill-sub-price bill-sub-price-stack">
                    <s className="bill-sub-list">{formatMoney(price.amount)}</s>
                    <span>{amountLabel}</span>
                  </span>
                ) : (
                  <span className="bill-sub-price">{amountLabel}</span>
                )}
              </p>
            </div>
            <button
              type="button"
              className="bill-close"
              onClick={requestClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </header>

          <AnimatePresence mode="wait" initial={false}>
            {step === "submitting" ? (
              <motion.div
                key="loading"
                className="bill-body bill-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <BrandLogoLoading label="Saving billing details…" />
              </motion.div>
            ) : null}

            {step === "done" ? (
              <motion.div
                key="done"
                className="bill-body bill-done"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: panelEase }}
              >
                <span className="bill-done-check" aria-hidden>
                  <svg viewBox="0 0 52 52" className="bill-done-check-svg">
                    <circle className="bill-done-check-ring" cx="26" cy="26" r="24" />
                    <path
                      className="bill-done-check-mark"
                      fill="none"
                      d="M15.5 27.2l7.2 7.2 14.2-14.8"
                    />
                  </svg>
                </span>
                <h3>Payment details saved</h3>
                {orderId ? (
                  <div className="bill-track">
                    <span className="bill-track-label">Tracking ID</span>
                    <code className="bill-track-id">{orderId}</code>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary glimmer-btn bill-done-btn"
                  onClick={requestClose}
                >
                  Done
                </button>
              </motion.div>
            ) : null}

            {step === "details" ? (
              <motion.form
                key="form"
                className="bill-form"
                onSubmit={onSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                noValidate
              >
                <div className="bill-body">
                  <div className="bill-account-type" role="tablist" aria-label="Account type">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={accountType === "individual"}
                      className={cn(
                        "bill-account-card",
                        "is-individual",
                        accountType === "individual" && "is-active"
                      )}
                      onClick={() => setAccountType("individual")}
                    >
                      <span className="bill-account-ico" aria-hidden>
                        <UserRound strokeWidth={2} />
                      </span>
                      <span className="bill-account-copy">
                        <strong>Individual</strong>
                        <em>Personal billing</em>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={accountType === "company"}
                      className={cn(
                        "bill-account-card",
                        "is-company",
                        accountType === "company" && "is-active"
                      )}
                      onClick={() => setAccountType("company")}
                    >
                      <span className="bill-account-ico" aria-hidden>
                        <Building2 strokeWidth={2} />
                      </span>
                      <span className="bill-account-copy">
                        <strong>Company</strong>
                        <em>Business account</em>
                      </span>
                    </button>
                  </div>

                  <div className="bill-row">
                    <label className={cn("bill-field", errors.firstName && "is-error")}>
                      <span>First name*</span>
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                      />
                      {errors.firstName ? <em>{errors.firstName}</em> : null}
                    </label>
                    <label className={cn("bill-field", errors.lastName && "is-error")}>
                      <span>Last name*</span>
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        autoComplete="family-name"
                      />
                      {errors.lastName ? <em>{errors.lastName}</em> : null}
                    </label>
                  </div>

                  {accountType === "company" ? (
                    <label className={cn("bill-field", errors.companyName && "is-error")}>
                      <span>Company name*</span>
                      <input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        autoComplete="organization"
                      />
                      {errors.companyName ? <em>{errors.companyName}</em> : null}
                    </label>
                  ) : null}

                  <label className={cn("bill-field", errors.country && "is-error")}>
                    <span>Country / region*</span>
                    <SmoothSelect
                      value={country}
                      onChange={setCountry}
                      options={countryOptions}
                      placeholder="Select country"
                      error={Boolean(errors.country)}
                      maxMenuHeight={260}
                      aria-label="Country of residence"
                    />
                    {errors.country ? <em>{errors.country}</em> : null}
                  </label>

                  <label className={cn("bill-field", errors.street && "is-error")}>
                    <span>Address*</span>
                    <input
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      autoComplete="street-address"
                      placeholder="Street and house number"
                    />
                    {errors.street ? <em>{errors.street}</em> : null}
                  </label>

                  <div className="bill-row">
                    <label className={cn("bill-field", errors.city && "is-error")}>
                      <span>City*</span>
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        autoComplete="address-level2"
                      />
                      {errors.city ? <em>{errors.city}</em> : null}
                    </label>
                    <label className={cn("bill-field", errors.postalCode && "is-error")}>
                      <span>Postal code*</span>
                      <input
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        autoComplete="postal-code"
                      />
                      {errors.postalCode ? <em>{errors.postalCode}</em> : null}
                    </label>
                  </div>

                  <label className={cn("bill-field", errors.email && "is-error")}>
                    <span>Billing email*</span>
                    <SmoothSelect
                      value={activeEmail}
                      onChange={setActiveEmail}
                      options={emailOptions}
                      placeholder="Add an email"
                      error={Boolean(errors.email)}
                      maxMenuHeight={200}
                      aria-label="Billing notification email"
                    />
                    {errors.email ? <em>{errors.email}</em> : null}
                  </label>
                  <div className="bill-email-box">
                    <span className="bill-email-list">
                      {emails.join(", ") || "No emails yet"}
                    </span>
                    <button
                      type="button"
                      className="bill-add-email"
                      onClick={() => {
                        setEmailError(null);
                        setAddEmailOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Add email
                    </button>
                  </div>

                  <fieldset className={cn("bill-methods", errors.card && "is-error")}>
                    <legend>Payment</legend>
                    <div className="bill-method-list" role="radiogroup" aria-label="Payment method">
                      {METHODS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={methodId === m.id}
                          className={cn(
                            "bill-method-row",
                            methodId === m.id && "is-active"
                          )}
                          onClick={() => setMethodId(m.id)}
                        >
                          <span className="bill-method-radio" aria-hidden />
                          <span className="bill-method-label">{m.shortLabel}</span>
                          <span className="bill-method-brands">
                            <PaymentMethodMark
                              id={m.id}
                              className="bill-method-mark"
                            />
                          </span>
                        </button>
                      ))}
                    </div>

                    {methodId === "card" ? (
                      <div className="bill-card-gate">
                        <button
                          type="button"
                          className={cn(
                            "bill-add-card",
                            cardDetailsOpen && "is-open"
                          )}
                          onClick={() => setCardDetailsOpen((v) => !v)}
                          aria-expanded={cardDetailsOpen}
                        >
                          <CreditCard className="h-4 w-4" aria-hidden />
                          {cardDetailsOpen ? "Hide card details" : "Enter card details"}
                        </button>
                        <AnimatePresence initial={false}>
                          {cardDetailsOpen ? (
                            <motion.div
                              key="card-fields"
                              className="bill-card-block"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: panelEase }}
                            >
                              <div className="bill-card-inner">
                                <label className="bill-field">
                                  <span>Name on card</span>
                                  <input
                                    value={cardName}
                                    onChange={(e) => setCardName(e.target.value)}
                                    autoComplete="cc-name"
                                    placeholder="Name as shown on card"
                                  />
                                </label>
                                <label
                                  className={cn(
                                    "bill-field",
                                    cardNumber &&
                                      !cardAnalysis.numberPotentiallyValid &&
                                      "is-error"
                                  )}
                                >
                                  <span className="bill-card-label-row">
                                    <span>Card number</span>
                                    {cardAnalysis.digits.length >= 2 ? (
                                      <span
                                        className={cn(
                                          "bill-card-detected",
                                          cardAnalysis.numberValid && "is-valid",
                                          cardAnalysis.digits.length >= 4 &&
                                            !cardAnalysis.isAcceptedBrand &&
                                            "is-unsupported"
                                        )}
                                      >
                                        {cardAnalysis.niceType}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="bill-card-number-wrap">
                                    <input
                                      value={cardNumber}
                                      onChange={(e) =>
                                        setCardNumber(formatCardNumber(e.target.value))
                                      }
                                      autoComplete="cc-number"
                                      inputMode="numeric"
                                      placeholder="Card number"
                                      maxLength={23}
                                      aria-invalid={
                                        cardNumber.length > 0 &&
                                        !cardAnalysis.numberPotentiallyValid
                                      }
                                    />
                                    <span className="bill-card-brand" aria-hidden>
                                      <CardBrandMark brand={cardAnalysis.brand} />
                                    </span>
                                  </span>
                                </label>
                                <div className="bill-row">
                                  <label
                                    className={cn(
                                      "bill-field",
                                      expiry &&
                                        !expiryAnalysis.isPotentiallyValid &&
                                        "is-error"
                                    )}
                                  >
                                    <span>Expiry</span>
                                    <input
                                      value={expiry}
                                      onChange={(e) =>
                                        setExpiry(formatExpiryInput(e.target.value))
                                      }
                                      autoComplete="cc-exp"
                                      inputMode="numeric"
                                      placeholder="MM / YY"
                                      maxLength={7}
                                    />
                                  </label>
                                  <label
                                    className={cn(
                                      "bill-field",
                                      cvc &&
                                        !cvvAnalysis.isPotentiallyValid &&
                                        "is-error"
                                    )}
                                  >
                                    <span>{cardAnalysis.codeName}</span>
                                    <input
                                      value={cvc}
                                      onChange={(e) =>
                                        setCvc(
                                          e.target.value
                                            .replace(/\D+/g, "")
                                            .slice(0, cardAnalysis.codeSize)
                                        )
                                      }
                                      autoComplete="cc-csc"
                                      inputMode="numeric"
                                      placeholder={cardAnalysis.codeName}
                                      maxLength={cardAnalysis.codeSize}
                                    />
                                  </label>
                                </div>
                                {cardAnalysis.digits.length >= 4 &&
                                !cardAnalysis.isAcceptedBrand ? (
                                  <p className="bill-hint bill-card-hint-warn">
                                    {cardAnalysis.niceType} detected. This checkout
                                    accepts Visa and Mastercard.
                                  </p>
                                ) : null}
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    ) : null}

                    {methodId === "oxapay" ? (
                      <div className="bill-card-block is-static bill-crypto-block">
                        <label className="bill-field bill-crypto-asset">
                          <span>Asset</span>
                          <SmoothSelect
                            value={cryptoAsset}
                            onChange={setCryptoAsset}
                            options={CRYPTO_OPTS}
                            maxMenuHeight={240}
                            menuClassName="is-crypto-menu"
                            aria-label="Crypto asset"
                          />
                        </label>
                        <label className="bill-field">
                          <span>Wallet (optional)</span>
                          <input
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            placeholder="Refund address"
                          />
                        </label>
                      </div>
                    ) : null}

                    {errors.card ? <em className="bill-error">{errors.card}</em> : null}
                  </fieldset>
                </div>

                <section className="bill-promo" aria-label="Offers and discounts">
                  <button
                    type="button"
                    className="bill-promo-summary"
                    onClick={() => setOffersOpen(true)}
                  >
                    <span className="bill-promo-summary-icon" aria-hidden>
                      <BadgePercent className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.1} />
                    </span>
                    <span className="bill-promo-summary-copy">
                      <strong>Offers &amp; discounts</strong>
                      <span>
                        {appliedPromo
                          ? "An offer is applied"
                          : "See available offers"}
                      </span>
                    </span>
                    <span className="bill-promo-summary-meta">
                      {availableOffers.length}{" "}
                      {availableOffers.length === 1 ? "offer" : "offers"}
                      <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                    </span>
                  </button>

                  <div
                    className={cn(
                      "bill-promo-field",
                      promoError && "is-error",
                      appliedPromo && "is-applied"
                    )}
                  >
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value.toUpperCase());
                        setPromoError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void applyPromoCode();
                        }
                      }}
                      placeholder="Enter promo code"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Promo code"
                      disabled={promoBusy}
                    />
                    <button
                      type="button"
                      className="bill-promo-apply-btn"
                      disabled={promoBusy || !promoInput.trim()}
                      onClick={() => void applyPromoCode()}
                    >
                      {promoBusy ? "…" : "Apply"}
                    </button>
                  </div>
                  {promoError ? (
                    <em className="bill-error bill-promo-error">{promoError}</em>
                  ) : null}

                  {appliedPromo ? (
                    <p className="bill-promo-applied">
                      <span className="bill-promo-applied-label">
                        Applied coupon code :
                      </span>
                      <span className="bill-promo-chip">
                        <TicketPercent className="h-3.5 w-3.5" aria-hidden />
                        {appliedPromo.code}
                        <button
                          type="button"
                          aria-label={`Remove ${appliedPromo.code}`}
                          onClick={clearPromo}
                        >
                          <X className="h-3 w-3" strokeWidth={2.75} />
                        </button>
                      </span>
                    </p>
                  ) : null}
                </section>

                <footer className="bill-foot">
                  <label
                    className={cn("bill-agree", agreed && "is-checked")}
                    htmlFor={agreeId}
                  >
                    <span className="bill-check">
                      <input
                        id={agreeId}
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                      />
                      <span className="bill-check-box" aria-hidden>
                        <Check className="bill-check-tick" strokeWidth={3} />
                      </span>
                    </span>
                    <span className="bill-agree-text">
                      I agree to the{" "}
                      <a href="/terms" target="_blank" rel="noreferrer">
                        Service Agreement
                      </a>{" "}
                      and{" "}
                      <a href="/privacy" target="_blank" rel="noreferrer">
                        Privacy Policy
                      </a>
                      .
                    </span>
                  </label>
                  {errors.agreed ? <em className="bill-error">{errors.agreed}</em> : null}
                  {submitError ? <em className="bill-error">{submitError}</em> : null}
                  <button type="submit" className="btn btn-primary glimmer-btn bill-submit">
                    <Lock className="h-4 w-4" aria-hidden />
                    Save billing details
                  </button>
                </footer>
              </motion.form>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </div>

      {createPortal(
        <AnimatePresence>
          {addEmailOpen ? (
            <motion.div
              className="bill-email-layer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <button
                type="button"
                className="bill-email-layer-backdrop"
                aria-label="Cancel"
                onClick={() => setAddEmailOpen(false)}
              />
              <motion.div
                className="bill-email-dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Add billing email"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.16, ease: panelEase }}
              >
                <header>
                  <h3>Add billing email</h3>
                  <button
                    type="button"
                    className="bill-close"
                    onClick={() => setAddEmailOpen(false)}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" strokeWidth={2.25} />
                  </button>
                </header>
                <p>Confirm to save this address to your billing profile.</p>
                <label className={cn("bill-field", emailError && "is-error")}>
                  <span>Email*</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      setEmailError(null);
                    }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addEmail();
                      }
                    }}
                  />
                  {emailError ? <em>{emailError}</em> : null}
                </label>
                <div className="bill-email-actions">
                  <button type="button" onClick={() => setAddEmailOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={addEmail}>
                    Save email
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {offersOpen ? (
            <motion.div
              className="bill-email-layer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <button
                type="button"
                className="bill-email-layer-backdrop"
                aria-label="Close offers"
                onClick={() => setOffersOpen(false)}
              />
              <motion.div
                className="bill-email-dialog bill-offers-dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Available offers"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.16, ease: panelEase }}
              >
                <header className="bill-offers-head">
                  <span className="bill-promo-summary-icon" aria-hidden>
                    <BadgePercent className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.1} />
                  </span>
                  <div className="bill-offers-head-copy">
                    <h3>Available offers</h3>
                    <p>
                      Offers available now, plus the closest ones you can unlock.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="bill-offers-close"
                    onClick={() => setOffersOpen(false)}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" strokeWidth={2.25} />
                  </button>
                </header>

                <div className="bill-offers-section">
                  <h4>Available now</h4>
                  <p>Select an offer to apply it instantly.</p>
                  <ul className="bill-offers-list">
                    {availableOffers.map((offer) => {
                      const selected = appliedPromo?.code === offer.code;
                      return (
                        <li key={offer.code}>
                          <div
                            className={cn(
                              "bill-offer-row",
                              selected && "is-selected"
                            )}
                          >
                            <span className="bill-offer-icon" aria-hidden>
                              <ShoppingBag
                                className="h-4 w-4"
                                strokeWidth={2.1}
                              />
                            </span>
                            <span className="bill-offer-copy">
                              <strong>{offer.label}</strong>
                              <span>{offer.description}</span>
                            </span>
                            <span className="bill-offer-save">
                              {offer.saveLabel}
                            </span>
                            <button
                              type="button"
                              className="bill-offer-go"
                              disabled={promoBusy}
                              aria-label={`Apply ${offer.code}`}
                              onClick={() => void applyPromoCode(offer.code)}
                            >
                              <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}
    </>,
    document.body
  );
}

export { BillingCheckout as PaymentModal };
