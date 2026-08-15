import valid from "card-validator";
import creditCardType from "credit-card-type";

/** Brands we settle as card checkout (catalogue). Others are detected but blocked on submit. */
export const ACCEPTED_CARD_BRANDS = ["visa", "mastercard"] as const;
export type AcceptedCardBrand = (typeof ACCEPTED_CARD_BRANDS)[number];

export type DetectedCardBrand =
  | AcceptedCardBrand
  | "american-express"
  | "discover"
  | "jcb"
  | "diners-club"
  | "unionpay"
  | "maestro"
  | "elo"
  | "mir"
  | "hiper"
  | "hipercard"
  | "unknown";

export type CardFieldAnalysis = {
  digits: string;
  formatted: string;
  brand: DetectedCardBrand;
  niceType: string;
  gaps: number[];
  lengths: number[];
  codeName: string;
  codeSize: number;
  numberValid: boolean;
  numberPotentiallyValid: boolean;
  isAcceptedBrand: boolean;
};

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

export function detectCardBrand(digits: string): {
  brand: DetectedCardBrand;
  niceType: string;
  gaps: number[];
  lengths: number[];
  codeName: string;
  codeSize: number;
} {
  const types = creditCardType(digits);
  const primary = types[0];
  if (!primary) {
    return {
      brand: "unknown",
      niceType: "Card",
      gaps: [4, 8, 12],
      lengths: [16],
      codeName: "CVC",
      codeSize: 3,
    };
  }
  return {
    brand: primary.type as DetectedCardBrand,
    niceType: primary.niceType,
    gaps: primary.gaps?.length ? primary.gaps : [4, 8, 12],
    lengths: primary.lengths?.length ? primary.lengths : [16],
    codeName: primary.code?.name || "CVC",
    codeSize: primary.code?.size || 3,
  };
}

/** Format PAN with brand-aware gaps (Visa 4-4-4-4, Amex 4-6-5, etc.). */
export function formatCardNumber(value: string): string {
  const digits = digitsOnly(value);
  const { gaps, lengths } = detectCardBrand(digits);
  const maxLen = Math.max(...lengths);
  const clipped = digits.slice(0, maxLen);
  if (!gaps.length) return clipped;

  let out = "";
  let cursor = 0;
  for (let i = 0; i < clipped.length; i++) {
    if (gaps[cursor] === i) {
      out += " ";
      cursor += 1;
    }
    out += clipped[i];
  }
  return out;
}

export function analyzeCardNumber(value: string): CardFieldAnalysis {
  const digits = digitsOnly(value);
  const meta = detectCardBrand(digits);
  const number = valid.number(digits);
  const brand = (number.card?.type as DetectedCardBrand | undefined) || meta.brand;
  const niceType = number.card?.niceType || meta.niceType;
  const gaps = number.card?.gaps?.length ? number.card.gaps : meta.gaps;
  const lengths = number.card?.lengths?.length ? number.card.lengths : meta.lengths;
  const codeName = number.card?.code?.name || meta.codeName;
  const codeSize = number.card?.code?.size || meta.codeSize;

  return {
    digits,
    formatted: formatCardNumber(digits),
    brand,
    niceType,
    gaps,
    lengths,
    codeName,
    codeSize,
    numberValid: Boolean(number.isValid),
    numberPotentiallyValid: Boolean(number.isPotentiallyValid),
    isAcceptedBrand: ACCEPTED_CARD_BRANDS.includes(brand as AcceptedCardBrand),
  };
}

export function formatExpiryInput(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

export function analyzeExpiry(value: string) {
  const result = valid.expirationDate(value);
  return {
    isValid: Boolean(result.isValid),
    isPotentiallyValid: Boolean(result.isPotentiallyValid),
    month: result.month || "",
    year: result.year || "",
  };
}

export function analyzeCvv(value: string, codeSize = 3) {
  const digits = digitsOnly(value).slice(0, Math.max(3, codeSize));
  const result = valid.cvv(digits, codeSize);
  return {
    digits,
    isValid: Boolean(result.isValid),
    isPotentiallyValid: Boolean(result.isPotentiallyValid),
  };
}

export function analyzeCardholderName(value: string) {
  const result = valid.cardholderName(value);
  return {
    isValid: Boolean(result.isValid),
    isPotentiallyValid: Boolean(result.isPotentiallyValid),
  };
}

export type CardCheckoutValidation =
  | { ok: true; brand: DetectedCardBrand; niceType: string; last4: string }
  | { ok: false; error: string };

/** Full client/server gate for card path submit. */
export function validateCardCheckout(input: {
  cardName: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}): CardCheckoutValidation {
  const name = analyzeCardholderName(input.cardName);
  if (!input.cardName.trim() || !name.isValid) {
    return { ok: false, error: "Enter the name on the card." };
  }

  const number = analyzeCardNumber(input.cardNumber);
  if (!number.numberValid) {
    return { ok: false, error: "Enter a valid card number." };
  }
  if (!number.isAcceptedBrand) {
    return {
      ok: false,
      error: `${number.niceType} detected — this checkout accepts Visa and Mastercard.`,
    };
  }

  const exp = analyzeExpiry(input.expiry);
  if (!exp.isValid) {
    return { ok: false, error: "Enter a valid expiry date (MM / YY)." };
  }

  const cvv = analyzeCvv(input.cvc, number.codeSize);
  if (!cvv.isValid) {
    return {
      ok: false,
      error: `Enter a valid ${number.codeName} (${number.codeSize} digits).`,
    };
  }

  return {
    ok: true,
    brand: number.brand,
    niceType: number.niceType,
    last4: number.digits.slice(-4),
  };
}
