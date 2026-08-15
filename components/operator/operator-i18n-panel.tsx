"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Languages, RefreshCw } from "lucide-react";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { useT } from "@/components/i18n/locale-provider";
import { toast } from "@/components/ui/toast";

type LocaleStatus = {
  locale: string;
  label: string;
  total: number;
  translated: number;
  missing: number;
  coverage: number;
};

type StatusPayload = {
  lastSyncAt: string | null;
  sourceKeys: number;
  locales: LocaleStatus[];
};

export function OperatorI18nPanel() {
  const t = useT();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

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
    if (!open) return;
    void load();
  }, [open, load]);

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
    <details
      className="op-card op-basic-drop"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="op-basic-drop-summary">
        <span className="op-basic-title">
          <Languages className="h-4 w-4" aria-hidden />
          {t("op.i18n.title")}
        </span>
        <ChevronDown className="op-basic-drop-chevron h-4 w-4" aria-hidden />
      </summary>

      <div className="op-basic-drop-body op-basic-panel">
        <div className="op-basic-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void load()}
            disabled={busy}
            aria-label={t("op.i18n.refresh")}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
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

        <p className="op-basic-meta">
          {status?.sourceKeys ?? "—"} keys
          {status?.lastSyncAt
            ? ` · synced ${new Date(status.lastSyncAt).toLocaleString()}`
            : " · never synced"}
        </p>

        <ul className="op-basic-list">
          {(status?.locales || []).map((loc) => (
            <li key={loc.locale}>
              <span>
                {loc.label} <code>{loc.locale}</code>
              </span>
              <span>
                {loc.coverage}%
                {loc.missing ? ` · ${loc.missing} missing` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
