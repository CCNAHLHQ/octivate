"use client";

import { useCallback, useEffect, useState } from "react";
import { Languages, RefreshCw } from "lucide-react";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { useT } from "@/components/i18n/locale-provider";
import { toast } from "@/components/ui/toast";

type LocaleStatus = {
  locale: string;
  label: string;
  total: number;
  translated: number;
  stale: number;
  missing: number;
  coverage: number;
  updatedAt: string;
};

type StatusPayload = {
  catalogVersion: number;
  lastSyncAt: string | null;
  sourceKeys: number;
  locales: LocaleStatus[];
};

export function OperatorI18nPanel() {
  const t = useT();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<StatusPayload>("/api/operator/i18n", {
        skipCache: true,
      });
      setStatus(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load i18n status");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncAll() {
    setBusy(true);
    try {
      await apiFetch("/api/operator/i18n", { method: "POST", json: {} });
      invalidateApiCache();
      toast.success("Translation sync finished");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="op-card op-fc-panel" aria-label={t("op.i18n.title")}>
      <div className="op-card-head">
        <div>
          <p className="op-kicker">
            <Languages className="h-3.5 w-3.5" aria-hidden />
            {t("op.i18n.title")}
          </p>
          <p className="op-card-lede">{t("op.i18n.lede")}</p>
        </div>
        <div className="op-card-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void load()}
            disabled={busy}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {t("op.i18n.refresh")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void syncAll()}
            disabled={busy}
          >
            {busy ? t("op.i18n.syncing") : t("op.i18n.sync")}
          </button>
        </div>
      </div>

      <div className="op-fc-stats">
        <span className="op-src-pulse-chip">
          {status?.sourceKeys ?? "—"} source keys
        </span>
        <span className="op-src-pulse-chip">
          v{status?.catalogVersion ?? "—"}
        </span>
        <span className="op-src-pulse-chip">
          {status?.lastSyncAt
            ? `Last sync ${new Date(status.lastSyncAt).toLocaleString()}`
            : "Never synced"}
        </span>
      </div>

      <ul className="op-fc-steps">
        {(status?.locales || []).map((loc) => (
          <li key={loc.locale} className="op-fc-step">
            <span className="op-fc-step-idx">{loc.coverage}%</span>
            <div>
              <div className="op-fc-step-top">
                <p>
                  {loc.label} <code>{loc.locale}</code>
                </p>
                <span>
                  {loc.translated}/{loc.total}
                  {loc.missing ? ` · ${loc.missing} missing` : ""}
                  {loc.stale ? ` · ${loc.stale} stale` : ""}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
