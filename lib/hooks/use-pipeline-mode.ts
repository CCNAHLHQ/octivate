"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PIPELINE_MODE_EVENT } from "@/lib/pipeline-mode-events";

export type PipelineHealth = {
  mock: boolean;
  openRouter?: {
    mode?: string;
    keyConfigured?: boolean;
    source?: string;
    defaultModel?: string;
  };
};

export function usePipelineMode() {
  const [health, setHealth] = useState<PipelineHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<PipelineHealth>("/api/health", { skipCache: true });
      setHealth(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(PIPELINE_MODE_EVENT, onChange);
    return () => window.removeEventListener(PIPELINE_MODE_EVENT, onChange);
  }, [refresh]);

  // Mock mode is retired — never treat "health not loaded" as mock.
  const isMock = false;
  const isLive = true;
  const keyConfigured = Boolean(health?.openRouter?.keyConfigured);
  const isInteractive = keyConfigured;

  return {
    health,
    loading,
    isMock,
    isLive,
    isInteractive,
    keyConfigured,
    mode: "live" as const,
    refresh,
  };
}
