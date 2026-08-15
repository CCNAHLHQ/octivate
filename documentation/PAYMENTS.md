# Octivate — Payment gateways

Checkout captures merchant billing details and queues purchases for provider fulfillment. Card, PayPal, and crypto paths are first-class; **OxaPay** is the documented crypto payment gateway for live settlement. Stripe is not offered in public checkout.

## Supported methods (UI + order payload)

| Method | `paymentMethodId` | Status |
|--------|-------------------|--------|
| Card (Visa / Mastercard) | `card` | Captured (PAN never stored; last4 only) |
| PayPal | `paypal` | Captured → awaiting provider API |
| Cryptocurrency via OxaPay | `oxapay` / `crypto` | Captured → awaiting [OxaPay Merchant API](https://oxapay.com/) |

## OxaPay

- Site: [https://oxapay.com/](https://oxapay.com/)
- Role: crypto payment gateway for invoices, payment links, white-label merchant checkout, and payouts
- Typical assets: BTC, ETH, USDT (TRC20/ERC20/BEP20), USDC, BNB, and other coins listed on OxaPay’s supported coins page
- Fees: published on OxaPay pricing (from ~0.4%; confirm on their site)
- Integration path (next): Merchant API invoice / white-label session → webhook → mark `merchant-orders` as `paid`

### Env placeholders (future)

```env
OXAPAY_MERCHANT_API_KEY=
OXAPAY_CALLBACK_URL=https://octivate.io/api/billing/oxapay/webhook
OXAPAY_SANDBOX=true
```

### Operator review

Submitted purchases appear in **Operator → Merchants** (`/dashboard/operator#merchants`).

Public submit: `POST /api/billing/checkout`  
Operator list / status: `GET|PATCH /api/operator/merchants` (operator API key + session)

## Security notes

- Never log or persist full card numbers or CVCs
- Checkout is a public mutation with rate limiting via `guardApi`
- Provider webhooks must verify signatures before flipping order status to `paid`
