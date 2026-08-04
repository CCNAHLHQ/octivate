"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";
import type { ExportTemplate } from "@/lib/types";

const PREVIEW_DEBOUNCE_MS = 320;

export function useExportTemplatePreview(
  selected: ExportTemplate | null,
  briefId: string,
  htmlBody: string
) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewStale, setPreviewStale] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const requestIdRef = useRef(0);
  const syncedSourceRef = useRef({ htmlBody: "", briefId: "" });
  const lastErrorRef = useRef<string | null>(null);

  const refreshPreview = useCallback(async () => {
    if (!selected) return;
    const requestId = ++requestIdRef.current;
    setPreviewLoading(true);
    try {
      const data = await apiFetch<{ html: string }>(
        `/api/operator/export-templates/${selected.id}/preview`,
        {
          method: "POST",
          json: {
            briefId: briefId || undefined,
            htmlBody,
          },
          skipCache: true,
        }
      );
      if (requestId !== requestIdRef.current) return;
      // Template-render errors arrive as an in-frame document (HTTP 200) — no toast needed.
      setPreviewHtml(data.html);
      setPreviewKey((k) => k + 1);
      syncedSourceRef.current = { htmlBody, briefId };
      setPreviewStale(false);
      lastErrorRef.current = null;
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Preview failed";
      // Only surface a toast when the failure changes — avoids a storm while typing.
      if (message !== lastErrorRef.current) {
        lastErrorRef.current = message;
        toast(message, "error");
      }
    } finally {
      if (requestId === requestIdRef.current) setPreviewLoading(false);
    }
  }, [selected, briefId, htmlBody]);

  useEffect(() => {
    if (!selected) {
      setPreviewHtml("");
      setPreviewStale(false);
      return;
    }

    const sourceChanged =
      htmlBody !== syncedSourceRef.current.htmlBody ||
      briefId !== syncedSourceRef.current.briefId;

    if (sourceChanged) setPreviewStale(true);

    const timer = window.setTimeout(() => {
      void refreshPreview();
    }, PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [selected?.id, htmlBody, briefId, refreshPreview]);

  useEffect(() => {
    if (!selected) return;
    syncedSourceRef.current = { htmlBody: "", briefId: "" };
    setPreviewStale(true);
    setPreviewHtml("");
  }, [selected?.id]);

  return {
    previewHtml,
    previewLoading,
    previewStale,
    previewKey,
    refreshPreview,
  };
}
