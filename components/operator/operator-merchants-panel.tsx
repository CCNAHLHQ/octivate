"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Globe2,
  Mail,
  MonitorSmartphone,
  RefreshCw,
  Route,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BrandLogoLoading } from "@/components/ui/brand-logo-loading";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { formatMoney } from "@/lib/billing/plans";
import type { MerchantOrder, MerchantOrderStatus } from "@/lib/billing/merchant-orders";
import {
  formatScreenSize,
  formatViewport,
  shortUrl,
  type MerchantClientContext,
} from "@/lib/billing/client-context";
import { cn } from "@/lib/utils";
import "@/app/pricing/pricing.css";

type MerchantsResponse = {
  orders: MerchantOrder[];
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  counts: { total: number; awaiting: number; paid: number };
};

const STATUS_OPTS: MerchantOrderStatus[] = [
  "awaiting_provider",
  "paid",
  "cancelled",
  "failed",
  "submitted",
];

const PAGE_SIZE = 8;

function formatStamp(iso?: string | null) {
  if (!iso) return { relative: "—", absolute: "—", iso: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { relative: "—", absolute: iso, iso };
  }
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  let relative = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (mins < 1) relative = "just now";
  else if (mins < 60) relative = `${mins}m ago`;
  else if (mins < 48 * 60) relative = `${Math.round(mins / 60)}h ago`;

  const absolute = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(d);

  return { relative, absolute, iso: d.toISOString() };
}

function StatusGlyph({ status }: { status: MerchantOrderStatus }) {
  return (
    <svg className="op-m-status-svg" viewBox="0 0 40 40" aria-hidden>
      <circle
        className="op-m-status-ring"
        cx="20"
        cy="20"
        r="15"
        fill="none"
        strokeWidth="2"
      />
      {status === "paid" ? (
        <path
          className="op-m-status-mark"
          d="M12.5 20.5l5 5 10-11"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : status === "failed" || status === "cancelled" ? (
        <path
          className="op-m-status-mark"
          d="M14 14l12 12M26 14L14 26"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      ) : (
        <circle className="op-m-status-pulse" cx="20" cy="20" r="4.5" />
      )}
    </svg>
  );
}

function CardArt({
  accountType,
  method,
}: {
  accountType: MerchantOrder["accountType"];
  method: string;
}) {
  return (
    <span className="op-m-art" aria-hidden>
      <svg viewBox="0 0 56 56" className="op-m-art-svg">
        <defs>
          <linearGradient id="opmGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--tide)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--violet)" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <rect
          x="4"
          y="8"
          width="48"
          height="40"
          rx="10"
          fill="url(#opmGrad)"
          opacity="0.35"
        />
        <rect
          className="op-m-art-card"
          x="10"
          y="14"
          width="36"
          height="28"
          rx="6"
          fill="none"
          strokeWidth="1.6"
        />
        <rect
          className="op-m-art-chip"
          x="16"
          y="22"
          width="8"
          height="6"
          rx="1"
          fill="currentColor"
          opacity="0.55"
        />
        {accountType === "company" ? (
          <path
            d="M30 34V24h4v10h3V22h-10v12h3zm-12 0V26h3v8h3v-6h3v6h3V24H18v10h0z"
            fill="currentColor"
            opacity="0.7"
          />
        ) : (
          <path
            d="M28 24a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 10c3.3 0 6 1.6 6 3.5V39H22v-1.5c0-1.9 2.7-3.5 6-3.5z"
            fill="currentColor"
            opacity="0.7"
          />
        )}
        <text
          x="28"
          y="48"
          textAnchor="middle"
          fontSize="5.5"
          fill="currentColor"
          opacity="0.55"
          fontFamily="ui-monospace, monospace"
        >
          {method.slice(0, 8)}
        </text>
      </svg>
    </span>
  );
}

function AnalyticsRow({
  ctx,
  ip,
}: {
  ctx?: MerchantClientContext | null;
  ip?: string;
}) {
  if (!ctx && !ip) {
    return (
      <p className="op-m-analytics-empty">No browser telemetry on this order.</p>
    );
  }

  const items = [
    {
      icon: <Globe2 className="h-3 w-3" />,
      label: "IP",
      value: ctx?.ip || ip || "—",
      title: ctx?.cfCountry ? `CF ${ctx.cfCountry}` : undefined,
    },
    {
      icon: <MonitorSmartphone className="h-3 w-3" />,
      label: "UA",
      value: [ctx?.browser, ctx?.os].filter(Boolean).join(" · ") || "—",
      title: ctx?.userAgent,
    },
    {
      icon: <MonitorSmartphone className="h-3 w-3" />,
      label: "Screen",
      value: formatScreenSize(ctx),
      title: `Viewport ${formatViewport(ctx)}`,
    },
    {
      icon: <Route className="h-3 w-3" />,
      label: "Referrer",
      value: shortUrl(ctx?.referrer),
      title: ctx?.referrer || "Direct / none",
    },
    {
      icon: <Route className="h-3 w-3" />,
      label: "Landing",
      value: shortUrl(ctx?.landingUrl || ctx?.pageUrl),
      title: ctx?.landingUrl || ctx?.pageUrl,
    },
    {
      icon: <Globe2 className="h-3 w-3" />,
      label: "Nav",
      value: [
        ctx?.navigationType || "—",
        typeof ctx?.redirectCount === "number"
          ? `${ctx.redirectCount} hops`
          : null,
        ctx?.timezone,
      ]
        .filter(Boolean)
        .join(" · "),
      title: ctx?.connectionType
        ? `Connection ${ctx.connectionType}`
        : undefined,
    },
  ];

  return (
    <ul className="op-m-analytics">
      {items.map((item) => (
        <li key={item.label} title={item.title}>
          <span className="op-m-analytics-ico">{item.icon}</span>
          <span className="op-m-analytics-label">{item.label}</span>
          <span className="op-m-analytics-val">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function OperatorMerchantsPanel() {
  const [data, setData] = useState<MerchantsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async (nextPage = page) => {
    const qs = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(PAGE_SIZE),
    });
    if (statusFilter) qs.set("status", statusFilter);
    const res = await apiFetch<MerchantsResponse>(
      `/api/operator/merchants?${qs}`,
      { skipCache: true }
    );
    setData(res);
    setPage(res.page);
  }, [page, statusFilter]);

  useEffect(() => {
    setLoading(true);
    void load(1)
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Failed to load merchants")
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on filter change from page 1
  }, [statusFilter]);

  async function setStatus(id: string, status: MerchantOrderStatus) {
    setBusyId(id);
    try {
      await apiFetch("/api/operator/merchants", {
        method: "PATCH",
        json: { id, status },
      });
      invalidateApiCache("/api/operator/merchants");
      await load(page);
      toast.success("Order updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function goPage(next: number) {
    setLoading(true);
    try {
      await load(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load page");
    } finally {
      setLoading(false);
    }
  }

  const orders = data?.orders || [];
  const pageCount = data?.pageCount || 1;

  const kpi = useMemo(
    () => [
      { label: "Total", value: data?.counts.total ?? 0 },
      { label: "Awaiting", value: data?.counts.awaiting ?? 0 },
      { label: "Paid", value: data?.counts.paid ?? 0 },
    ],
    [data]
  );

  if (loading && !data) {
    return (
      <div className="op-merchants">
        <BrandLogoLoading label="Loading merchant purchases…" />
      </div>
    );
  }

  return (
    <div className="op-merchants">
      <header className="op-merchants-head">
        <div>
          <h2>Merchant purchases</h2>
          <p>
            Checkout submissions with browser telemetry for operator review.
          </p>
        </div>
        <div className="op-merchants-head-actions">
          <select
            className="op-m-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true);
              void load(page)
                .catch((err) =>
                  toast.error(
                    err instanceof Error ? err.message : "Refresh failed"
                  )
                )
                .finally(() => setLoading(false));
            }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "op-m-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="op-merchants-kpis">
        {kpi.map((k) => (
          <article key={k.label}>
            <span>{k.label}</span>
            <strong>{k.value}</strong>
          </article>
        ))}
      </div>

      <div className="op-merchants-scroll">
        <AnimatePresence mode="popLayout">
          {orders.length === 0 ? (
            <motion.p
              key="empty"
              className="op-merchants-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              No merchant submissions yet. Completed checkouts on /pricing will
              appear here.
            </motion.p>
          ) : (
            <ul className="op-merchants-list">
              {orders.map((o, idx) => {
                const created = formatStamp(o.createdAt);
                const updated = formatStamp(o.updatedAt);
                const clientStamp = formatStamp(o.clientContext?.clientSubmittedAt);
                const serverStamp = formatStamp(
                  o.clientContext?.serverReceivedAt || o.createdAt
                );
                return (
                  <motion.li
                    key={o.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.18) }}
                    className={cn("op-merchants-card", `is-${o.status}`)}
                  >
                    <CardArt accountType={o.accountType} method={o.paymentMethodId} />
                    <div className="op-m-card-main">
                      <div className="op-merchants-card-top">
                        <div className="op-m-identity">
                          <h3>
                            {o.accountType === "company" ? (
                              <Building2 className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <UserRound className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {o.firstName} {o.lastName}
                            {o.companyName ? (
                              <span className="op-m-co"> · {o.companyName}</span>
                            ) : null}
                          </h3>
                          <p className="op-merchants-meta">
                            {o.planId} · {formatMoney(o.amount)}
                            {o.promoCode
                              ? ` · ${o.promoCode} (−${formatMoney(o.discountAmount || 0)})`
                              : ""}{" "}
                            · {o.paymentMethodId}
                          </p>
                        </div>
                        <div className="op-m-status-block">
                          <StatusGlyph status={o.status} />
                          <select
                            value={o.status}
                            disabled={busyId === o.id}
                            onChange={(e) =>
                              void setStatus(
                                o.id,
                                e.target.value as MerchantOrderStatus
                              )
                            }
                          >
                            {STATUS_OPTS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="op-merchants-grid">
                        <p>
                          <Mail className="h-3 w-3" aria-hidden />
                          <span>{o.emails.join(", ")}</span>
                        </p>
                        <p>
                          <CreditCard className="h-3 w-3" aria-hidden />
                          <span>
                            {o.cardLast4
                              ? `${
                                  (typeof o.providerMeta?.cardNiceType ===
                                    "string" &&
                                    o.providerMeta.cardNiceType) ||
                                  o.cardBrand ||
                                  "Card"
                                } •••• ${o.cardLast4}`
                              : o.cryptoAsset
                                ? o.cryptoAsset.toUpperCase()
                                : o.paymentMethodId}
                          </span>
                        </p>
                        <p className="op-m-addr">
                          {o.street}, {o.city} {o.postalCode}, {o.country}
                        </p>
                      </div>

                      <AnalyticsRow ctx={o.clientContext} ip={o.sourceIp} />

                      <footer className="op-m-times">
                        <div>
                          <span>Created</span>
                          <time dateTime={created.iso} title={created.absolute}>
                            {created.relative}
                          </time>
                          <em>{created.absolute}</em>
                        </div>
                        <div>
                          <span>Updated</span>
                          <time dateTime={updated.iso} title={updated.absolute}>
                            {updated.relative}
                          </time>
                          <em>{updated.absolute}</em>
                        </div>
                        <div>
                          <span>Client clock</span>
                          <time
                            dateTime={clientStamp.iso}
                            title={clientStamp.absolute}
                          >
                            {clientStamp.relative}
                          </time>
                          <em>{clientStamp.absolute}</em>
                        </div>
                        <div>
                          <span>Server recv</span>
                          <time
                            dateTime={serverStamp.iso}
                            title={serverStamp.absolute}
                          >
                            {serverStamp.relative}
                          </time>
                          <em>{serverStamp.absolute}</em>
                        </div>
                        <code className="op-merchants-id" title={o.id}>
                          {o.id}
                        </code>
                      </footer>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </AnimatePresence>
      </div>

      <nav className="op-merchants-pager" aria-label="Merchant pages">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => void goPage(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Button>
        <span>
          Page {page} / {pageCount}
          <em>
            · {data?.total ?? 0} order{(data?.total ?? 0) === 1 ? "" : "s"}
          </em>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page >= pageCount || loading}
          onClick={() => void goPage(page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </nav>
    </div>
  );
}
