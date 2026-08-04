"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api-client";
import type { CountryPack } from "@/lib/types";

export default function PacksPage() {
  const [packs, setPacks] = useState<CountryPack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ packs: CountryPack[] }>("/api/packs");
        setPacks(data.packs);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Country packs</h1>
          <p className="mt-1 text-sm text-mist">Curated intelligence packs by Caribbean market.</p>
        </div>
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((p) => (
              <Card key={p.id} hover className="p-4">
                <h2 className="font-display text-xl font-semibold">{p.country}</h2>
                <p className="mt-2 font-mono text-xs text-faint">
                  {p.sources} sources · {p.entities} entities
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.sectors.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-teal/25 bg-teal/10 px-2 py-0.5 font-mono text-[10px] text-teal"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
