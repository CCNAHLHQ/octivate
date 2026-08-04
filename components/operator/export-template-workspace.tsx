"use client";

import { useState, type RefObject } from "react";
import { Code2, Download, Eye, Loader2, MousePointerClick, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ExportTemplateVisualEditor } from "@/components/operator/export-template-visual-editor";
import type { ExportFormat } from "@/lib/types";
import { cn } from "@/lib/utils";

const FORMAT_TIPS: Record<ExportFormat, string> = {
  html: "Download rendered HTML — same output as live preview",
  pdf: "Print-quality PDF transcoded from the HTML template",
  docx: "Word document transcoded from the HTML template",
  pptx: "Slide deck derived from HTML sections and headings",
};

const FORMATS: ExportFormat[] = ["html", "pdf", "docx", "pptx"];

function formatLabel(f: ExportFormat) {
  return f.toUpperCase();
}

export function ExportTemplateWorkspace({
  htmlBody,
  onHtmlChange,
  onSourceBlur,
  templateKey,
  previewHtml,
  previewLoading,
  previewStale,
  previewKey,
  previewRef,
  previewRootRef,
  onRefreshPreview,
  supportsFormats,
  busyId,
  sourceSaving,
  onExport,
}: {
  htmlBody: string;
  onHtmlChange: (value: string) => void;
  onSourceBlur?: () => void;
  templateKey?: string | null;
  previewHtml: string;
  previewLoading: boolean;
  previewStale?: boolean;
  previewKey?: number;
  previewRef: RefObject<HTMLIFrameElement>;
  previewRootRef: RefObject<HTMLDivElement>;
  onRefreshPreview: () => void;
  supportsFormats: ExportFormat[];
  busyId: string | null;
  sourceSaving?: boolean;
  onExport: (format: ExportFormat) => void;
}) {
  const [mode, setMode] = useState<"code" | "visual">("code");
  const showPreviewOverlay = previewLoading || previewStale;

  return (
    <div className="exp-workspace-shell">
      <div className="exp-workspace-head">
        <span className="exp-workspace-title">Template editor</span>
        <div className="exp-workspace-tools">
          {showPreviewOverlay && (
            <span className="exp-preview-status-pill">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {previewLoading ? "Rendering" : "Updating"}
            </span>
          )}
          <Tooltip content="Refresh preview" side="bottom">
            <Button
              size="sm"
              variant="ghost"
              disabled={previewLoading}
              onClick={onRefreshPreview}
              aria-label="Refresh preview"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", previewLoading && "animate-spin")} />
            </Button>
          </Tooltip>
          <span className="exp-workspace-tools-divider" aria-hidden />
          {FORMATS.map((format) => (
            <Tooltip key={format} content={FORMAT_TIPS[format]} side="bottom">
              <Button
                size="sm"
                variant="ghost"
                className="exp-export-btn"
                disabled={!supportsFormats.includes(format) || !!busyId}
                onClick={() => onExport(format)}
                aria-label={`Export ${formatLabel(format)}`}
              >
                <Download className="h-3.5 w-3.5" />
                {formatLabel(format)}
              </Button>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="exp-workspace-split">
        <section className="exp-split-pane exp-split-pane-source" aria-label="Template source">
          <div className="exp-split-pane-head exp-split-pane-head-tabs">
            <div className="exp-source-tabs">
              <button
                type="button"
                className={cn("exp-source-tab", mode === "code" && "is-active")}
                onClick={() => setMode("code")}
                aria-pressed={mode === "code"}
              >
                <Code2 aria-hidden />
                HTML
              </button>
              <button
                type="button"
                className={cn("exp-source-tab", mode === "visual" && "is-active")}
                onClick={() => setMode("visual")}
                aria-pressed={mode === "visual"}
              >
                <MousePointerClick aria-hidden />
                Visual
              </button>
              {sourceSaving && (
                <span className="exp-source-save-pill">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  Autosaving
                </span>
              )}
            </div>
          </div>
          <div className="exp-split-pane-body">
            {mode === "code" ? (
              <textarea
                className="exp-code-editor"
                value={htmlBody}
                onChange={(e) => onHtmlChange(e.target.value)}
                onBlur={onSourceBlur}
                spellCheck={false}
                aria-label="HTML template source"
              />
            ) : (
              <ExportTemplateVisualEditor
                key={`visual-${templateKey ?? "none"}`}
                htmlBody={htmlBody}
                onHtmlChange={onHtmlChange}
                onCommit={onSourceBlur}
              />
            )}
          </div>
        </section>

        <div className="exp-workspace-split-divider" aria-hidden />

        <section className="exp-split-pane exp-split-pane-preview" aria-label="Live preview">
          <div className="exp-split-pane-head">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            <span>Live preview</span>
            {previewStale && !previewLoading && (
              <span className="exp-preview-stale-label">Out of date</span>
            )}
          </div>
          <div className="exp-split-pane-body">
            {previewHtml ? (
              <div
                className={cn("exp-preview-frame-wrap", showPreviewOverlay && "is-updating")}
                ref={previewRootRef}
              >
                <iframe
                  key={previewKey}
                  ref={previewRef}
                  title="Template preview"
                  className="exp-preview-frame"
                  srcDoc={previewHtml}
                  sandbox="allow-same-origin"
                />
                {showPreviewOverlay && (
                  <div className="exp-preview-overlay" aria-live="polite">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    <span>{previewLoading ? "Rendering preview…" : "Syncing edits…"}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="exp-preview-empty">
                {previewLoading ? "Rendering preview…" : "Preview will appear here"}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
