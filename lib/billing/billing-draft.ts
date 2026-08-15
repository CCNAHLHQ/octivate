import type { PaymentMethodId } from "@/lib/billing/plans";

export const BILLING_DRAFT_KEY = "octivate-billing-draft-v1";

export type BillingDraft = {
  accountType: "individual" | "company";
  firstName: string;
  lastName: string;
  companyName: string;
  country: string;
  street: string;
  city: string;
  postalCode: string;
  emails: string[];
  activeEmail: string;
  methodId: PaymentMethodId;
  cardName: string;
  /** Persisted for convenience; never send CVC from storage alone. */
  cardNumber: string;
  expiry: string;
  cryptoAsset: string;
  walletAddress: string;
  agreed: boolean;
  updatedAt: number;
};

export function loadBillingDraft(): BillingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BILLING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BillingDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBillingDraft(draft: Omit<BillingDraft, "updatedAt">) {
  if (typeof window === "undefined") return;
  try {
    const payload: BillingDraft = { ...draft, updatedAt: Date.now() };
    localStorage.setItem(BILLING_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
