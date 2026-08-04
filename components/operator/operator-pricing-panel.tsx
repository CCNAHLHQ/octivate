"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DollarSign,
  Info,
  Pencil,
  RefreshCw,
  Save,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import {
  resolvePrice,
  type BillingInterval,
  type PlanDefinition,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import "@/app/pricing/pricing.css";

export function OperatorPricingPanel() {
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch<{ plans: PlanDefinition[] }>("/api/operator/pricing", {
      skipCache: true,
    });
    setPlans(res.plans);
    setDirty(false);
  }, []);

  useEffect(() => {
    void load()
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load plans"))
      .finally(() => setLoading(false));
  }, [load]);

  function updatePlan(id: string, patch: Partial<PlanDefinition>) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setDirty(true);
  }

  function updatePrice(id: string, interval: BillingInterval, amount: number) {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const current = p.prices[interval] ?? resolvePrice(p, p.defaultInterval);
        return {
          ...p,
          prices: {
            ...p.prices,
            [interval]: { ...current, amount },
          },
        };
      })
    );
    setDirty(true);
  }

  function updateFeatures(id: string, text: string) {
    const features = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    updatePlan(id, { features });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch<{ plans: PlanDefinition[] }>("/api/operator/pricing", {
        method: "PATCH",
        json: { plans },
      });
      setPlans(res.plans);
      setDirty(false);
      invalidateApiCache("/api/pricing");
      invalidateApiCache("/api/operator/pricing");
      toast.success("Pricing saved — live on /pricing");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    try {
      await load();
      toast.success("Pricing reloaded");
    } catch {
      toast.error("Refresh failed");
    }
  }

  if (loading) {
    return <p className="text-sm text-mist">Loading pricing catalogue…</p>;
  }

  return (
    <div className="op-pricing pricing-root">
      <div className="op-pricing-toolbar">
        <div>
          <h2 className="op-pricing-title">
            <DollarSign className="h-4 w-4 text-violet" aria-hidden />
            Pricing editor
          </h2>
          <p className="op-pricing-sub">Edit plan cards. Save publishes to the public pricing page.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content="Reload saved catalogue">
            <Button size="sm" variant="ghost" onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </Button>
          </Tooltip>
          <Tooltip content={dirty ? "Publish changes" : "No unsaved changes"}>
            <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="pricing-grid op-pricing-grid">
        {plans.map((plan) => {
          const interval = plan.defaultInterval;
          const price = resolvePrice(plan, interval);
          return (
            <article
              key={plan.id}
              className={cn("price-card op-price-card", plan.featured && "is-featured")}
            >
              <header className="price-head">
                <div className="op-price-title-row">
                  <label className="op-price-field">
                    <span className="op-price-label">
                      <Pencil className="h-3 w-3" aria-hidden />
                      Plan name
                    </span>
                    <input
                      className="op-price-input"
                      value={plan.name}
                      onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                    />
                  </label>
                  <Tooltip content="Highlight this plan on the public page">
                    <button
                      type="button"
                      className={cn("op-featured-toggle", plan.featured && "is-on")}
                      onClick={() => updatePlan(plan.id, { featured: !plan.featured })}
                      aria-pressed={!!plan.featured}
                    >
                      <Star className="h-3.5 w-3.5" aria-hidden />
                      Featured
                    </button>
                  </Tooltip>
                </div>

                <div className="op-price-amount">
                  <label className="op-price-field">
                    <span className="op-price-label">
                      <DollarSign className="h-3 w-3" aria-hidden />
                      Amount (USD)
                      <Tooltip content="Shown with currency formatting on /pricing">
                        <Info className="h-3 w-3 text-faint" aria-hidden />
                      </Tooltip>
                    </span>
                    <input
                      className="op-price-input is-num"
                      type="number"
                      min={0}
                      step={0.01}
                      value={price.amount}
                      onChange={(e) =>
                        updatePrice(plan.id, interval, Number(e.target.value) || 0)
                      }
                    />
                  </label>
                  <span className="op-price-unit">{price.unitLabel || "free"}</span>
                </div>

                <label className="op-price-field">
                  <span className="op-price-label">Badge</span>
                  <input
                    className="op-price-input"
                    value={plan.badge || ""}
                    placeholder="Optional badge"
                    onChange={(e) =>
                      updatePlan(plan.id, { badge: e.target.value || undefined })
                    }
                  />
                </label>

                <label className="op-price-field">
                  <span className="op-price-label">Description</span>
                  <textarea
                    className="op-price-input is-area"
                    rows={2}
                    value={plan.description}
                    onChange={(e) => updatePlan(plan.id, { description: e.target.value })}
                  />
                </label>
              </header>

              <label className="op-price-field">
                <span className="op-price-label">
                  Features
                  <Tooltip content="One feature per line">
                    <Info className="h-3 w-3 text-faint" aria-hidden />
                  </Tooltip>
                </span>
                <textarea
                  className="op-price-input is-area is-features"
                  rows={6}
                  value={plan.features.join("\n")}
                  onChange={(e) => updateFeatures(plan.id, e.target.value)}
                />
              </label>

              <label className="op-price-field">
                <span className="op-price-label">CTA label</span>
                <input
                  className="op-price-input"
                  value={plan.ctaLabel}
                  onChange={(e) => updatePlan(plan.id, { ctaLabel: e.target.value })}
                />
              </label>
            </article>
          );
        })}
      </div>
    </div>
  );
}
