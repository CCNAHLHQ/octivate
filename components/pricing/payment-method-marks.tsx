/** Compact gateway marks for Shopify-style payment rows. */
import type { PaymentMethodId } from "@/lib/billing/plans";

export function PaymentMethodMark({
  id,
  className,
}: {
  id: PaymentMethodId;
  className?: string;
}) {
  if (id === "paypal") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src="/payments/paypal-color.svg"
        alt=""
        width={56}
        height={16}
      />
    );
  }

  if (id === "card") {
    return (
      <span className={className} style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/payments/visa.svg" alt="" width={36} height={12} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/payments/mastercard.svg" alt="" width={34} height={22} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src="/payments/bitcoin.svg"
      alt=""
      width={18}
      height={18}
    />
  );
}
