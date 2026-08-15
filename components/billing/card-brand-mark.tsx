"use client";

import type { DetectedCardBrand } from "@/lib/billing/card-validation";
import { cn } from "@/lib/utils";

/** Compact brand SVGs for detection UI (official-ish geometry + brand colors). */
export function CardBrandMark({
  brand,
  className,
  title,
}: {
  brand: DetectedCardBrand | string | null | undefined;
  className?: string;
  title?: string;
}) {
  const b = (brand || "unknown") as DetectedCardBrand;
  const label = title || brandNice(b);

  return (
    <span
      className={cn("card-brand-mark", `is-${b}`, className)}
      title={label}
      role="img"
      aria-label={label}
    >
      {renderBrand(b)}
    </span>
  );
}

function brandNice(brand: DetectedCardBrand) {
  switch (brand) {
    case "visa":
      return "Visa";
    case "mastercard":
      return "Mastercard";
    case "american-express":
      return "American Express";
    case "discover":
      return "Discover";
    case "jcb":
      return "JCB";
    case "diners-club":
      return "Diners Club";
    case "unionpay":
      return "UnionPay";
    case "maestro":
      return "Maestro";
    default:
      return "Card";
  }
}

function renderBrand(brand: DetectedCardBrand) {
  switch (brand) {
    case "visa":
      // Official-style Visa wordmark (same geometry as /payments/visa.svg), white on Visa blue.
      return (
        <svg viewBox="0 0 48 32" aria-hidden focusable="false">
          <rect width="48" height="32" rx="4" fill="#1A1F71" />
          <path
            fill="#fff"
            transform="translate(5.2 8.4) scale(1.55)"
            d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"
          />
        </svg>
      );
    case "mastercard":
      return (
        <svg viewBox="0 0 48 32" aria-hidden focusable="false">
          <rect width="48" height="32" rx="4" fill="#111827" />
          <circle cx="19.5" cy="16" r="7.2" fill="#EB001B" />
          <circle cx="28.5" cy="16" r="7.2" fill="#F79E1B" />
          <path
            fill="#FF5F00"
            d="M24 10.55a7.2 7.2 0 0 1 0 10.9 7.2 7.2 0 0 1 0-10.9z"
          />
        </svg>
      );
    case "american-express":
      return (
        <svg viewBox="0 0 48 32" aria-hidden focusable="false">
          <rect width="48" height="32" rx="4" fill="#2E77BC" />
          <text
            x="24"
            y="20"
            textAnchor="middle"
            fill="#fff"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="700"
            fontSize="9"
            letterSpacing="0.06em"
          >
            AMEX
          </text>
        </svg>
      );
    case "discover":
      return (
        <svg viewBox="0 0 48 32" aria-hidden focusable="false">
          <rect width="48" height="32" rx="4" fill="#fff" stroke="#E5E7EB" />
          <circle cx="34" cy="16" r="8" fill="#F6851B" />
          <text
            x="14"
            y="19.5"
            textAnchor="middle"
            fill="#111827"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="700"
            fontSize="7"
          >
            DISC
          </text>
        </svg>
      );
    case "jcb":
      return (
        <svg viewBox="0 0 48 32" aria-hidden focusable="false">
          <rect width="48" height="32" rx="4" fill="#0B4EA2" />
          <text
            x="24"
            y="20"
            textAnchor="middle"
            fill="#fff"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="700"
            fontSize="11"
          >
            JCB
          </text>
        </svg>
      );
    case "diners-club":
      return (
        <svg viewBox="0 0 48 32" aria-hidden focusable="false">
          <rect width="48" height="32" rx="4" fill="#0079BE" />
          <circle cx="20" cy="16" r="7" fill="none" stroke="#fff" strokeWidth="1.6" />
          <circle cx="28" cy="16" r="7" fill="none" stroke="#fff" strokeWidth="1.6" />
        </svg>
      );
    case "unionpay":
      return (
        <svg viewBox="0 0 48 32" aria-hidden focusable="false">
          <rect width="48" height="32" rx="4" fill="#E21836" />
          <rect x="14" y="8" width="20" height="16" rx="2" fill="#00447C" />
          <text
            x="24"
            y="19"
            textAnchor="middle"
            fill="#fff"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="700"
            fontSize="6.5"
          >
            UnionPay
          </text>
        </svg>
      );
    case "maestro":
      return (
        <svg viewBox="0 0 48 32" aria-hidden focusable="false">
          <rect width="48" height="32" rx="4" fill="#111827" />
          <circle cx="19.5" cy="16" r="7.2" fill="#EB001B" />
          <circle cx="28.5" cy="16" r="7.2" fill="#00A2E5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 48 32" aria-hidden focusable="false">
          <rect width="48" height="32" rx="4" fill="#334155" />
          <rect x="8" y="10" width="32" height="4" rx="1" fill="#94A3B8" />
          <rect x="8" y="18" width="18" height="3" rx="1" fill="#64748B" />
        </svg>
      );
  }
}
