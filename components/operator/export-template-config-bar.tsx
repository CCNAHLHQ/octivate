"use client";

import { useState } from "react";
import { AlertCircle, Check, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import type { TemplateSaveStatus } from "@/components/operator/use-export-template-draft";
import { cn } from "@/lib/utils";

export type ExportDraft = {
  name: string;
  subjectPreset: string;
  campaignSubject: string;
};

const STATUS_COPY: Record<
  TemplateSaveStatus,
  { label: string; tooltip: string }
> = {
  saved: { label: "Saved", tooltip: "All changes saved to server · click to save now" },
  saving: { label: "Saving", tooltip: "Writing changes to server…" },
  dirty: { label: "Unsaved", tooltip: "Edits pending — autosaves shortly · click to save now" },
  error: { label: "Save failed", tooltip: "Last save failed · click to retry" },
};

export function ExportTemplateConfigBar({
  draft,
  briefId,
  briefs,
  saveStatus,
  onDraftChange,
  onBriefChange,
  onManualSave,
  onFieldBlur,
}: {
  draft: ExportDraft;
  briefId: string;
  briefs: { id: string; title: string }[];
  saveStatus: TemplateSaveStatus;
  onDraftChange: (patch: Partial<ExportDraft>) => void;
  onBriefChange: (id: string) => void;
  onManualSave: () => void;
  onFieldBlur?: () => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const status = STATUS_COPY[saveStatus];

  return (
    <div className="exp-config">
      <div className="exp-config-row">
        <div className="exp-field exp-config-row-name">
          <label htmlFor="exp-name">Template name</label>
          <Input
            id="exp-name"
            value={draft.name}
            onChange={(e) => onDraftChange({ name: e.target.value })}
            onBlur={onFieldBlur}
            placeholder="Untitled template"
          />
        </div>
        <Tooltip content={status.tooltip} side="bottom">
          <button
            type="button"
            className={cn(
              "exp-config-status",
              saveStatus === "saved" && "is-saved",
              saveStatus === "dirty" && "is-dirty",
              saveStatus === "error" && "is-error"
            )}
            onClick={onManualSave}
            disabled={saveStatus === "saving"}
          >
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> {status.label}
              </>
            ) : saveStatus === "error" ? (
              <>
                <AlertCircle className="h-3 w-3" /> {status.label}
              </>
            ) : saveStatus === "dirty" ? (
              <>
                <span className="exp-config-status-dot" aria-hidden /> {status.label}
              </>
            ) : (
              <>
                <Check className="h-3 w-3" /> {status.label}
              </>
            )}
          </button>
        </Tooltip>
      </div>

      <div className="exp-config-grid">
        <div className="exp-field">
          <label htmlFor="exp-brief">Preview brief</label>
          <Select
            id="exp-brief"
            value={briefId}
            onChange={(e) => onBriefChange(e.target.value)}
            onBlur={onFieldBlur}
          >
            {briefs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="exp-field">
          <label htmlFor="exp-subject">Subject preset</label>
          <Input
            id="exp-subject"
            value={draft.subjectPreset}
            onChange={(e) => onDraftChange({ subjectPreset: e.target.value })}
            onBlur={onFieldBlur}
            placeholder="Decision brief"
          />
        </div>
      </div>

      <button
        type="button"
        className={cn("exp-config-more", advancedOpen && "is-open")}
        aria-expanded={advancedOpen}
        onClick={() => setAdvancedOpen((o) => !o)}
      >
        <ChevronRight aria-hidden />
        Email options
      </button>

      {advancedOpen && (
        <div className="exp-config-advanced">
          <div className="exp-field">
            <label htmlFor="exp-campaign">Campaign subject</label>
            <Input
              id="exp-campaign"
              value={draft.campaignSubject}
              onChange={(e) => onDraftChange({ campaignSubject: e.target.value })}
              onBlur={onFieldBlur}
              placeholder="{{brief.title}}"
            />
          </div>
        </div>
      )}
    </div>
  );
}
