"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  FileText,
  Link2,
  MapPin,
  Quote,
  Trash2,
  X,
} from "lucide-react";
import {
  AutosaveStatusPill,
  CONTROL_AUTOSAVE_MS,
  type AutosaveStatus,
} from "@/components/operator/autosave-status";
import { TagChipsInput } from "@/components/sources/tag-chips-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconSelect } from "@/components/ui/icon-select";
import { toast } from "@/components/ui/toast";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { PROJECT_COUNTRIES, countryFlagUrl, resolveSourceCountry } from "@/lib/geo/countries";
import { notifySourcesChanged } from "@/lib/sources/events";
import { useMounted } from "@/lib/use-mounted";
import type { Source, SourceBriefUse, SourceRetrievalPriority, SourceWatchPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  source: Source | null;
  onClose: () => void;
  onSaved: (source: Source) => void;
  onDeleted?: (id: string) => void;
};

type Draft = {
  title: string;
  country: string;
  type: string;
  url: string;
  primaryRetrievalUrl: string;
  dataPublicationsUrl: string;
  sectorTags: string[];
  psnLayers: string[];
  userRelevance: string[];
  evidenceRoles: string[];
  watchPriority: SourceWatchPriority;
  retrievalPriority: SourceRetrievalPriority;
  briefUse: SourceBriefUse | "";
  humanReviewRequired: boolean;
  notes: string;
  institutionOwner: string;
  subregion: string;
};

type SectionId = "identity" | "urls" | "tags" | "priority";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "urls", label: "URLs" },
  { id: "tags", label: "Tags" },
  { id: "priority", label: "Priority" },
];

function toDraft(s: Source): Draft {
  return {
    title: s.title || "",
    country: s.country || "",
    type: s.type || "",
    url: s.url || "",
    primaryRetrievalUrl: s.primaryRetrievalUrl || "",
    dataPublicationsUrl: s.dataPublicationsUrl || "",
    sectorTags: [...(s.sectorTags || [])],
    psnLayers: [...(s.psnLayers || [])],
    userRelevance: [...(s.userRelevance || [])],
    evidenceRoles: [...(s.evidenceRoles || [])],
    watchPriority: s.watchPriority || "Secondary",
    retrievalPriority: s.retrievalPriority || "Medium",
    briefUse: s.briefUse || "",
    humanReviewRequired: Boolean(s.humanReviewRequired),
    notes: s.notes || "",
    institutionOwner: s.institutionOwner || "",
    subregion: s.subregion || "",
  };
}

function snapshot(d: Draft): string {
  return JSON.stringify(d);
}

function draftPayload(draft: Draft) {
  return {
    title: draft.title.trim(),
    country: draft.country.trim(),
    type: draft.type.trim(),
    url: draft.url.trim() || null,
    primaryRetrievalUrl: draft.primaryRetrievalUrl.trim() || null,
    dataPublicationsUrl: draft.dataPublicationsUrl.trim() || null,
    sectorTags: draft.sectorTags,
    psnLayers: draft.psnLayers,
    userRelevance: draft.userRelevance,
    evidenceRoles: draft.evidenceRoles,
    watchPriority: draft.watchPriority,
    retrievalPriority: draft.retrievalPriority,
    briefUse: draft.briefUse || null,
    humanReviewRequired: draft.humanReviewRequired,
    notes: draft.notes.trim() || null,
    institutionOwner: draft.institutionOwner.trim() || null,
    subregion: draft.subregion.trim() || null,
  };
}

export function SourceEditor({ source, onClose, onSaved, onDeleted }: Props) {
  const mounted = useMounted();
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<Draft | null>(null);
  const savedSnapRef = useRef("");
  const sourceIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveChainRef = useRef(Promise.resolve<void>(undefined));
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("saved");
  const [section, setSection] = useState<SectionId>("identity");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!source) {
      clearSaveTimer();
      draftRef.current = null;
      sourceIdRef.current = null;
      setDraft(null);
      setSaveStatus("saved");
      setSection("identity");
      setDeleteOpen(false);
      return;
    }
    // Same id: parent list refresh from autosave must not wipe in-progress typing.
    if (sourceIdRef.current === source.id && draftRef.current) return;

    const next = toDraft(source);
    draftRef.current = next;
    savedSnapRef.current = snapshot(next);
    sourceIdRef.current = source.id;
    setDraft(next);
    setSaveStatus("saved");
    setSection("identity");
    clearSaveTimer();
  }, [source, clearSaveTimer]);

  const persistNow = useCallback(async () => {
    const id = sourceIdRef.current;
    const body = draftRef.current;
    if (!id || !body) return;
    if (snapshot(body) === savedSnapRef.current) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saving");
    try {
      const data = await apiFetch<{ source: Source }>(`/api/sources/${id}`, {
        method: "PATCH",
        json: draftPayload(body),
        skipCache: true,
      });
      // Keep in-flight local edits; only advance baseline when still matching what we sent.
      const sent = snapshot(body);
      if (draftRef.current && snapshot(draftRef.current) === sent) {
        savedSnapRef.current = sent;
        setSaveStatus("saved");
      } else {
        savedSnapRef.current = sent;
        setSaveStatus((s) => (s === "dirty" || s === "saving" ? "dirty" : "saved"));
      }
      invalidateApiCache("/api/sources");
      onSavedRef.current(data.source);
    } catch (err) {
      setSaveStatus("error");
      toast.error(err instanceof Error ? err.message : "Autosave failed");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (!draftRef.current) return;
    if (snapshot(draftRef.current) !== savedSnapRef.current) {
      setSaveStatus((status) => (status === "saving" ? "saving" : "dirty"));
    }
    clearSaveTimer();
    saveTimerRef.current = window.setTimeout(() => {
      saveChainRef.current = saveChainRef.current
        .then(() => persistNow())
        .catch(() => undefined);
    }, CONTROL_AUTOSAVE_MS);
  }, [clearSaveTimer, persistNow]);

  const flushSave = useCallback(async () => {
    clearSaveTimer();
    await saveChainRef.current
      .then(() => persistNow())
      .catch(() => undefined);
  }, [clearSaveTimer, persistNow]);

  useEffect(() => () => clearSaveTimer(), [clearSaveTimer]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      draftRef.current = next;
      return next;
    });
    scheduleSave();
  }

  function jumpTo(id: SectionId) {
    setSection(id);
    const el = bodyRef.current?.querySelector(`[data-src-section="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function closeEditor() {
    await flushSave();
    onClose();
  }

  async function runDelete() {
    if (!source || deleting) return;
    setDeleting(true);
    try {
      clearSaveTimer();
      await apiFetch(`/api/sources/${source.id}`, {
        method: "DELETE",
        skipCache: true,
      });
      invalidateApiCache("/api/sources");
      notifySourcesChanged();
      toast.success(`Deleted “${source.title}”`);
      setDeleteOpen(false);
      onDeleted?.(source.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!source) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleteOpen && !deleting) {
        e.preventDefault();
        void closeEditor();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // closeEditor intentionally omitted — flush uses latest refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, deleteOpen, deleting]);

  const countryOptions = useMemo(() => {
    const base = PROJECT_COUNTRIES.map((c) => ({
      value: c.name,
      label: c.name,
      leading: (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={countryFlagUrl(c.code, 20)}
          alt=""
          width={14}
          height={10}
          className="ws-country-flag"
        />
      ),
    }));
    if (draft?.country && !PROJECT_COUNTRIES.some((c) => c.name === draft.country)) {
      return [
        {
          value: draft.country,
          label: draft.country,
          leading: <MapPin aria-hidden />,
        },
        ...base,
      ];
    }
    return base;
  }, [draft?.country]);

  const briefOptions = useMemo(
    () => [
      { value: "", label: "Unset", leading: <Quote aria-hidden /> },
      { value: "Direct Citation", label: "Direct Citation", leading: <Quote aria-hidden /> },
      {
        value: "Cite with Context",
        label: "Cite with Context",
        leading: <Quote aria-hidden />,
      },
      { value: "Background Only", label: "Background Only", leading: <FileText aria-hidden /> },
    ],
    []
  );

  if (!mounted || !source || !draft) return null;

  const countryOpt = resolveSourceCountry(draft.country);
  const flagSrc = countryOpt ? countryFlagUrl(countryOpt.code, 20) : "";

  return createPortal(
    <div className="src-edit-root" role="presentation">
      <button
        type="button"
        className="src-edit-backdrop"
        aria-label="Dismiss"
        disabled={deleting}
        onClick={() => void closeEditor()}
      />
      <aside
        className="src-edit-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="src-edit-head">
          <div className="src-edit-head-copy">
            <div className="src-edit-head-row">
              <p className="src-edit-kicker">Source desk</p>
              <AutosaveStatusPill
                status={saveStatus}
                onRetry={() => void flushSave()}
                className="src-edit-autosave"
              />
            </div>
            <h2 id={titleId} className="src-edit-title">
              {draft.title || "Untitled"}
            </h2>
            <p className="src-edit-sub">
              Changes autosave · Esc to close
            </p>
          </div>
          <button
            type="button"
            className="src-edit-close"
            aria-label="Close"
            disabled={deleting}
            onClick={() => void closeEditor()}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="src-edit-tabs" aria-label="Editor sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cn("src-edit-tab", section === s.id && "is-active")}
              onClick={() => jumpTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div ref={bodyRef} className="src-edit-body ops-scroll">
          <section className="src-edit-section" data-src-section="identity">
            <h3 className="src-edit-section-title">Identity</h3>
            <div className="src-edit-grid">
              <label className="src-edit-field src-edit-field-wide">
                <span className="src-edit-label">Title</span>
                <input
                  className="src-edit-input"
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="src-edit-field">
                <span className="src-edit-label">Country</span>
                <span className="src-edit-country">
                  {flagSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flagSrc} alt="" width={16} height={12} className="ws-country-flag" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5 src-edit-country-ico" aria-hidden />
                  )}
                  <IconSelect
                    id="src-edit-country"
                    aria-label="Country"
                    value={draft.country}
                    options={countryOptions}
                    onChange={(v) => set("country", v)}
                    placeholder="Select country"
                  />
                </span>
              </label>
              <label className="src-edit-field">
                <span className="src-edit-label">Type</span>
                <input
                  className="src-edit-input"
                  value={draft.type}
                  onChange={(e) => set("type", e.target.value)}
                  placeholder="Agency, think tank…"
                />
              </label>
              <label className="src-edit-field">
                <span className="src-edit-label">Institution</span>
                <span className="src-edit-with-ico">
                  <Building2 className="src-edit-field-ico" aria-hidden />
                  <input
                    className="src-edit-input has-ico"
                    value={draft.institutionOwner}
                    onChange={(e) => set("institutionOwner", e.target.value)}
                  />
                </span>
              </label>
              <label className="src-edit-field">
                <span className="src-edit-label">Subregion</span>
                <input
                  className="src-edit-input"
                  value={draft.subregion}
                  onChange={(e) => set("subregion", e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="src-edit-section" data-src-section="urls">
            <h3 className="src-edit-section-title">URLs</h3>
            <div className="src-edit-grid">
              <label className="src-edit-field src-edit-field-wide">
                <span className="src-edit-label">Homepage</span>
                <span className="src-edit-with-ico">
                  <Link2 className="src-edit-field-ico" aria-hidden />
                  <input
                    className="src-edit-input is-mono has-ico"
                    value={draft.url}
                    onChange={(e) => set("url", e.target.value)}
                    placeholder="https://"
                    inputMode="url"
                  />
                </span>
              </label>
              <label className="src-edit-field src-edit-field-wide">
                <span className="src-edit-label">Primary retrieval</span>
                <input
                  className="src-edit-input is-mono"
                  value={draft.primaryRetrievalUrl}
                  onChange={(e) => set("primaryRetrievalUrl", e.target.value)}
                  placeholder="https://"
                  inputMode="url"
                />
              </label>
              <label className="src-edit-field src-edit-field-wide">
                <span className="src-edit-label">Publications / data</span>
                <input
                  className="src-edit-input is-mono"
                  value={draft.dataPublicationsUrl}
                  onChange={(e) => set("dataPublicationsUrl", e.target.value)}
                  placeholder="https://"
                  inputMode="url"
                />
              </label>
            </div>
          </section>

          <section className="src-edit-section" data-src-section="tags">
            <h3 className="src-edit-section-title">Tags</h3>
            <div className="src-edit-stack">
              <TagChipsInput
                label="Sector tags"
                value={draft.sectorTags}
                onChange={(sectorTags) => set("sectorTags", sectorTags)}
                hint="Enter or comma to add"
              />
              <TagChipsInput
                label="PSN layers"
                value={draft.psnLayers}
                onChange={(psnLayers) => set("psnLayers", psnLayers)}
                placeholder="Power, Systems…"
              />
              <TagChipsInput
                label="User relevance"
                value={draft.userRelevance}
                onChange={(userRelevance) => set("userRelevance", userRelevance)}
              />
              <TagChipsInput
                label="Evidence roles"
                value={draft.evidenceRoles}
                onChange={(evidenceRoles) => set("evidenceRoles", evidenceRoles)}
              />
            </div>
          </section>

          <section className="src-edit-section" data-src-section="priority">
            <h3 className="src-edit-section-title">Priority</h3>
            <div className="src-edit-stack">
              <div className="src-edit-field">
                <span className="src-edit-label">Watch</span>
                <div className="src-edit-seg" role="group" aria-label="Watch priority">
                  {(["Core", "Secondary"] as SourceWatchPriority[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={cn("src-edit-seg-btn", draft.watchPriority === v && "is-on")}
                      onClick={() => set("watchPriority", v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="src-edit-field">
                <span className="src-edit-label">Retrieval</span>
                <div className="src-edit-seg" role="group" aria-label="Retrieval priority">
                  {(["High", "Medium", "Low"] as SourceRetrievalPriority[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={cn(
                        "src-edit-seg-btn",
                        draft.retrievalPriority === v && "is-on"
                      )}
                      onClick={() => set("retrievalPriority", v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="src-edit-field">
                <span className="src-edit-label">Brief use</span>
                <IconSelect
                  id="src-edit-brief"
                  aria-label="Brief use"
                  value={draft.briefUse}
                  options={briefOptions}
                  onChange={(v) => set("briefUse", v as SourceBriefUse | "")}
                />
              </div>
              <label className="src-edit-check">
                <input
                  type="checkbox"
                  checked={draft.humanReviewRequired}
                  onChange={(e) => set("humanReviewRequired", e.target.checked)}
                />
                <span>Human review required</span>
              </label>
              <label className="src-edit-field">
                <span className="src-edit-label">Notes</span>
                <textarea
                  className="src-edit-input is-area"
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Registry notes, caveats…"
                />
              </label>
            </div>
          </section>
        </div>

        <footer className="src-edit-foot">
          <button
            type="button"
            className="src-edit-btn is-danger"
            disabled={deleting}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button
            type="button"
            className="src-edit-btn is-primary"
            disabled={deleting}
            onClick={() => void closeEditor()}
          >
            Done
          </button>
        </footer>
      </aside>

      <ConfirmDialog
        open={deleteOpen}
        busy={deleting}
        busyLabel="Deleting…"
        title="Delete this source?"
        description={`Remove “${source.title}” from the live registry. This cannot be undone.`}
        confirmLabel="Delete source"
        onCancel={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        onConfirm={() => void runDelete()}
      />
    </div>,
    document.body
  );
}
