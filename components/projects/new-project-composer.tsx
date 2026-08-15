"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderPlus, Plus, Sparkles, X } from "lucide-react";
import {
  CountrySelect,
  SectorSelect,
} from "@/components/projects/country-sector-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  sector: string;
  onSectorChange: (value: string) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  /** Soft pulse when the catalogue is empty to invite first create. */
  invite?: boolean;
};

export function NewProjectComposer({
  open,
  onOpenChange,
  name,
  onNameChange,
  country,
  onCountryChange,
  sector,
  onSectorChange,
  saving,
  onSubmit,
  invite = false,
}: Props) {
  const t = useT();
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const canSubmit = Boolean(name.trim() && country && sector) && !saving;

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => nameRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onOpenChange]);

  return (
    <div className="ws-new-project">
      <motion.button
        type="button"
        className={cn("ws-new-project-trigger", invite && !open && "is-invite", open && "is-open")}
        data-tour="projects-new"
        aria-expanded={open}
        aria-controls={titleId}
        onClick={() => onOpenChange(!open)}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
      >
        <span className="ws-new-project-trigger-glow" aria-hidden />
        <span className="ws-new-project-trigger-icon" aria-hidden>
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </span>
        <span className="ws-new-project-trigger-copy">
          <span className="ws-new-project-trigger-kicker">
            {invite ? t("ws.projects.newInvite") : t("ws.projects.new")}
          </span>
          <span className="ws-new-project-trigger-sub">
            {open ? t("ws.projects.newClose") : t("ws.projects.newHint")}
          </span>
        </span>
        <FolderPlus className="ws-new-project-trigger-mark" aria-hidden />
      </motion.button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={titleId}
            className="ws-new-project-panel"
            role="region"
            aria-label={t("ws.projects.new")}
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="ws-new-project-panel-inner">
              <div className="ws-new-project-panel-head">
                <Sparkles className="h-4 w-4" aria-hidden />
                <div>
                  <p className="ws-new-project-panel-title">{t("ws.projects.create")}</p>
                  <p className="ws-new-project-panel-lede">{t("ws.projects.newPanelLede")}</p>
                </div>
              </div>

              <form onSubmit={onSubmit} className="ws-new-project-form">
                <label className="ws-new-project-field">
                  <span>{t("ws.projects.name")}</span>
                  <Input
                    ref={nameRef}
                    placeholder={t("ws.projects.namePlaceholder")}
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="ws-new-project-field">
                  <span>{t("ws.projects.country")}</span>
                  <CountrySelect
                    value={country}
                    onChange={onCountryChange}
                    required
                    disabled={saving}
                  />
                </label>
                <label className="ws-new-project-field">
                  <span>{t("ws.projects.sector")}</span>
                  <SectorSelect
                    value={sector}
                    onChange={onSectorChange}
                    required
                    disabled={saving}
                  />
                </label>

                <div className="ws-new-project-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => onOpenChange(false)}
                  >
                    {t("ws.projects.cancel")}
                  </Button>
                  <Button type="submit" size="sm" disabled={!canSubmit}>
                    {saving ? t("ws.projects.creating") : t("ws.projects.create")}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
