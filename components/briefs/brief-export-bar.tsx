"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { downloadBlob, exportBriefFile } from "@/lib/export/client-export";
import { toast } from "@/components/ui/toast";
import type { ExportFormat, ExportTemplate } from "@/lib/types";

const FORMATS: ExportFormat[] = ["html", "pdf", "docx", "pptx"];
const DEFAULT_TEMPLATE_ID = "tpl_octivate_brief";

export function BriefExportBar({ briefId }: { briefId: string }) {
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ templates: ExportTemplate[]; defaultTemplateId?: string }>(
      "/api/export-templates",
      { skipCache: true }
    )
      .then((data) => {
        const active = data.templates.filter((t) => t.enabled !== false);
        setTemplates(
          active.length
            ? active
            : [{ id: DEFAULT_TEMPLATE_ID, name: "Octivate Decision Brief" } as ExportTemplate]
        );
        setTemplateId(
          data.defaultTemplateId ||
            active.find((t) => t.id === DEFAULT_TEMPLATE_ID)?.id ||
            active[0]?.id ||
            DEFAULT_TEMPLATE_ID
        );
      })
      .catch(() => {
        setTemplates([
          { id: DEFAULT_TEMPLATE_ID, name: "Octivate Decision Brief" } as ExportTemplate,
        ]);
        setTemplateId(DEFAULT_TEMPLATE_ID);
      });
  }, []);

  async function runExport(format: ExportFormat) {
    if (!templateId) {
      toast.error("Select an export template");
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

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--ghost-bg)] p-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Export brief</span>
      <Select
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
        className="min-w-[180px]"
      >
        {(templates.length
          ? templates
          : [{ id: DEFAULT_TEMPLATE_ID, name: "Octivate Decision Brief" }]
        ).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      {FORMATS.map((format) => (
        <Button
          key={format}
          size="sm"
          variant="ghost"
          disabled={!!busy}
          onClick={() => void runExport(format)}
        >
          <Download className="h-3.5 w-3.5" />
          {busy === format ? "…" : format.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
