/**
 * Merchant purchase submissions from public checkout.
 * Persisted locally until OxaPay / Stripe / PayPal APIs are wired.
 */
import { randomBytes } from "crypto";
import { readObject, writeObject } from "@/lib/store/json-store";
import type { BillingInterval, PaymentMethodId, PlanId } from "@/lib/billing/plans";
import type { MerchantClientContext } from "@/lib/billing/client-context";

const STORE_KEY = "merchant-orders";

export type MerchantAccountType = "individual" | "company";
export type MerchantOrderStatus =
  | "submitted"
  | "awaiting_provider"
  | "paid"
  | "cancelled"
  | "failed";

export type MerchantOrder = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: MerchantOrderStatus;
  accountType: MerchantAccountType;
  firstName: string;
  lastName: string;
  companyName?: string;
  country: string;
  street: string;
  city: string;
  postalCode: string;
  emails: string[];
  paymentMethodId: PaymentMethodId;
  planId: PlanId;
  interval: BillingInterval;
  amount: number;
  currency: "USD";
  /** Catalogue price before promo */
  listAmount?: number;
  promoCode?: string;
  discountAmount?: number;
  /** Never store full PAN — last4 only when card path used */
  cardLast4?: string;
  cardBrand?: string;
  cryptoAsset?: string;
  walletAddress?: string;
  agreementAccepted: boolean;
  notes?: string;
  sourceIp?: string;
  /** Browser / network telemetry for operator review */
  clientContext?: MerchantClientContext;
  /** Reserved for provider session / invoice ids */
  providerMeta?: Record<string, string | number | boolean | null>;
};

export type MerchantOrderInput = {
  accountType: MerchantAccountType;
  firstName: string;
  lastName: string;
  companyName?: string;
  country: string;
  street: string;
  city: string;
  postalCode: string;
  emails: string[];
  paymentMethodId: PaymentMethodId;
  planId: PlanId;
  interval: BillingInterval;
  amount: number;
  currency?: "USD";
  listAmount?: number;
  promoCode?: string;
  discountAmount?: number;
  cardLast4?: string;
  cardBrand?: string;
  cryptoAsset?: string;
  walletAddress?: string;
  agreementAccepted: boolean;
  notes?: string;
  sourceIp?: string;
  clientContext?: MerchantClientContext;
  providerMeta?: Record<string, string | number | boolean | null>;
};

function uid() {
  return `mord_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export async function listMerchantOrders(): Promise<MerchantOrder[]> {
  const rows = await readObject<MerchantOrder[]>(STORE_KEY, []);
  return Array.isArray(rows)
    ? [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
}

export async function createMerchantOrder(
  input: MerchantOrderInput
): Promise<MerchantOrder> {
  const now = new Date().toISOString();
  const order: MerchantOrder = {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    status: "awaiting_provider",
    accountType: input.accountType,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    companyName: input.companyName?.trim() || undefined,
    country: input.country.trim(),
    street: input.street.trim(),
    city: input.city.trim(),
    postalCode: input.postalCode.trim(),
    emails: input.emails.map((e) => e.trim().toLowerCase()).filter(Boolean),
    paymentMethodId: input.paymentMethodId,
    planId: input.planId,
    interval: input.interval,
    amount: Number(input.amount) || 0,
    currency: input.currency || "USD",
    listAmount:
      input.listAmount != null ? Number(input.listAmount) || 0 : undefined,
    promoCode: input.promoCode?.trim() || undefined,
    discountAmount:
      input.discountAmount != null
        ? Number(input.discountAmount) || 0
        : undefined,
    cardLast4: input.cardLast4,
    cardBrand: input.cardBrand,
    cryptoAsset: input.cryptoAsset,
    walletAddress: input.walletAddress,
    agreementAccepted: Boolean(input.agreementAccepted),
    notes: input.notes,
    sourceIp: input.sourceIp || input.clientContext?.ip,
    clientContext: input.clientContext,
    providerMeta: {
      gatewayReady: false,
      ...(input.providerMeta || {}),
    },
  };

  const existing = await listMerchantOrders();
  existing.unshift(order);
  await writeObject(STORE_KEY, existing.slice(0, 2000));
  return order;
}

export async function updateMerchantOrderStatus(
  id: string,
  status: MerchantOrderStatus
): Promise<MerchantOrder | null> {
  const rows = await listMerchantOrders();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  rows[idx] = {
    ...rows[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  await writeObject(STORE_KEY, rows);
  return rows[idx];
}
