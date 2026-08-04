"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";
import type { ExportFormat, ExportTemplate } from "@/lib/types";

export type ExportTemplateDraft = {
  name: string;
  subjectPreset: string;
  campaignSubject: string;
  htmlBody: string;
  supportsFormats: ExportFormat[];
};

export type TemplateSaveStatus = "saved" | "saving" | "dirty" | "error";

const EMPTY_DRAFT: ExportTemplateDraft = {
  name: "",
  subjectPreset: "",
  campaignSubject: "",
  htmlBody: "",
  supportsFormats: ["html", "pdf", "docx", "pptx"],
};

const AUTOSAVE_MS = 650;

function draftFromTemplate(template: ExportTemplate): ExportTemplateDraft {
  return {
    name: template.name,
    subjectPreset: template.subjectPreset ?? "",
    campaignSubject: template.campaignSubject ?? "",
    htmlBody: template.htmlBody,
    supportsFormats: template.supportsFormats,
  };
}

function snapshot(draft: ExportTemplateDraft) {
  return JSON.stringify(draft);
}

export function useExportTemplateDraft(
  selected: ExportTemplate | null,
  onSaved: (template: ExportTemplate) => void
) {
  const [draft, setDraftState] = useState<ExportTemplateDraft>(EMPTY_DRAFT);
  const [saveStatus, setSaveStatus] = useState<TemplateSaveStatus>("saved");

  const draftRef = useRef(draft);
  const savedSnapshotRef = useRef(snapshot(EMPTY_DRAFT));
  const templateIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveChainRef = useRef(Promise.resolve<void>(undefined));

  draftRef.current = draft;

  const isDirty = saveStatus !== "saved";

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const loadFromTemplate = useCallback(
    (template: ExportTemplate) => {
      // Cancel any queued autosave from the previous template before swapping state.
      clearSaveTimer();
      const next = draftFromTemplate(template);
      draftRef.current = next;
      setDraftState(next);
      savedSnapshotRef.current = snapshot(next);
      templateIdRef.current = template.id;
      setSaveStatus("saved");
    },
    [clearSaveTimer]
  );

  useEffect(() => {
    if (selected) loadFromTemplate(selected);
    else {
      clearSaveTimer();
      draftRef.current = EMPTY_DRAFT;
      setDraftState(EMPTY_DRAFT);
      savedSnapshotRef.current = snapshot(EMPTY_DRAFT);
      templateIdRef.current = null;
      setSaveStatus("saved");
    }
  }, [selected?.id, loadFromTemplate, clearSaveTimer]);

  const persistNow = useCallback(
    async (silent = true): Promise<ExportTemplate | null> => {
      const id = templateIdRef.current;
      if (!id) return null;

      const body = draftRef.current;
      if (snapshot(body) === savedSnapshotRef.current) {
        setSaveStatus("saved");
        return null;
      }

      setSaveStatus("saving");
      try {
        const data = await apiFetch<{ template: ExportTemplate }>(
          `/api/operator/export-templates/${id}`,
          {
            method: "PATCH",
            json: {
              name: body.name.trim() || "Untitled template",
              subjectPreset: body.subjectPreset,
              campaignSubject: body.campaignSubject,
              htmlBody: body.htmlBody,
              supportsFormats: body.supportsFormats,
            },
          }
        );
        savedSnapshotRef.current = snapshot(body);
        setSaveStatus("saved");
        onSaved(data.template);
        invalidateApiCache("/api/operator/export-templates");
        if (!silent) toast.success("Template saved");
        return data.template;
      } catch (err) {
        setSaveStatus("error");
        if (!silent) toast.error(err instanceof Error ? err.message : "Save failed");
        throw err;
      }
    },
    [onSaved]
  );

  const scheduleSave = useCallback(() => {
    if (!templateIdRef.current) return;

    if (snapshot(draftRef.current) !== savedSnapshotRef.current) {
      setSaveStatus((status) => (status === "saving" ? "saving" : "dirty"));
    }

    clearSaveTimer();
    saveTimerRef.current = window.setTimeout(() => {
      saveChainRef.current = saveChainRef.current
        .then(() => persistNow(true).then(() => undefined))
        .catch(() => undefined);
    }, AUTOSAVE_MS);
  }, [persistNow, clearSaveTimer]);

  const updateDraft = useCallback(
    (patch: Partial<ExportTemplateDraft>) => {
      setDraftState((prev) => {
        const next = { ...prev, ...patch };
        draftRef.current = next;
        return next;
      });
      scheduleSave();
    },
    [scheduleSave]
  );

  const flushSave = useCallback(async () => {
    clearSaveTimer();
    await saveChainRef.current;
    if (snapshot(draftRef.current) === savedSnapshotRef.current) return null;
    return persistNow(true);
  }, [persistNow, clearSaveTimer]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (snapshot(draftRef.current) !== savedSnapshotRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => () => clearSaveTimer(), [clearSaveTimer]);

  return {
    draft,
    updateDraft,
    loadFromTemplate,
    saveStatus,
    isDirty,
    flushSave,
    persistNow,
  };
}
