"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api-client";
import { downloadBlob, exportBriefFile } from "@/lib/export/client-export";
import { toast } from "@/components/ui/toast";
import type { ExportTemplate } from "@/lib/types";

type QuickFormat = "html" | "pdf";

const DEFAULT_TEMPLATE_ID = "tpl_octivate_brief";

/**
 * Completion-gated quick export into the Octivate Decision Brief skeleton.
 * Uses live brief data (mock: false) — not demo placeholders.
 */
export function QuickExportButtons({
  briefId,
  ready,
}: {
  briefId?: string | null;
  ready: boolean;
}) {
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [templateReady, setTemplateReady] = useState(false);
  const [busy, setBusy] = useState<QuickFormat | null>(null);

  useEffect(() => {
    void apiFetch<{ templates: ExportTemplate[]; defaultTemplateId?: string }>(
      "/api/export-templates",
      { skipCache: true }
    )
      .then((data) => {
        const preferred =
          data.defaultTemplateId ||
          data.templates.find((t) => t.id === DEFAULT_TEMPLATE_ID)?.id ||
          data.templates[0]?.id ||
          DEFAULT_TEMPLATE_ID;
        setTemplateId(preferred);
        setTemplateReady(true);
      })
      .catch(() => {
        // Seed id still works server-side via templates-store upsert.
        setTemplateId(DEFAULT_TEMPLATE_ID);
        setTemplateReady(true);
      });
  }, []);

  const enabled = ready && !!briefId && !!templateId && templateReady;

  async function run(format: QuickFormat) {
    if (!briefId) {
      toast.warning("Complete a successful workflow first — no brief to export yet.");
      return;
    }
    if (!templateId) {
      toast.error("No export template available");
      return;
    }
    setBusy(format);
    try {
      const { blob, fileName } = await exportBriefFile({
        briefId,
        templateId,
        format,
        mock: false,
      });
      downloadBlob(blob, fileName);
      toast.success(`${format.toUpperCase()} export ready`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  const hint = !briefId
    ? "Run the workflow to completion to unlock export"
    : !templateReady
      ? "Loading export template…"
      : enabled
        ? undefined
        : "Available once the analysis completes";

  return (
    <div className="mt-1">
      <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-faint">
        {!enabled && <Lock className="h-3 w-3" aria-hidden />}
        Quick export
      </div>
      <div className="flex gap-2">
        <Tooltip content={hint ?? "Download rendered HTML into the brief skeleton"} side="top">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            disabled={!enabled || !!busy}
            onClick={() => void run("html")}
          >
            <FileText className="h-3.5 w-3.5" />
            {busy === "html" ? "…" : "HTML"}
          </Button>
        </Tooltip>
        <Tooltip content={hint ?? "Download print-quality PDF from the same template"} side="top">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            disabled={!enabled || !!busy}
            onClick={() => void run("pdf")}
          >
            <Download className="h-3.5 w-3.5" />
            {busy === "pdf" ? "…" : "PDF"}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
