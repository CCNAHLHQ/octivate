"use client";

import { useEffect, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ZoomIn } from "lucide-react";
import type { SupportAttachment } from "@/lib/support/types";
import { cn } from "@/lib/utils";

/** In-browser image preview only — never forces download or navigates away. */
export function SafeAttachmentThumb({
  attachment,
  onOpen,
  className,
}: {
  attachment: SupportAttachment;
  onOpen: (att: SupportAttachment) => void;
  className?: string;
}) {
  if (!attachment.dataUrl) {
    return (
      <span className={cn("scw-att is-meta", className)} title={attachment.name}>
        <span className="scw-att-meta">{attachment.name}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cn("scw-att", className)}
      onClick={() => onOpen(attachment)}
      aria-label={`Preview ${attachment.name}`}
      title={attachment.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.dataUrl}
        alt=""
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
      <span className="scw-att-zoom" aria-hidden>
        <ZoomIn className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

export function SafeImageLightbox({
  attachment,
  onClose,
}: {
  attachment: SupportAttachment | null;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!attachment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [attachment, onClose]);

  return (
    <AnimatePresence>
      {attachment?.dataUrl ? (
        <motion.div
          key={attachment.id}
          className="scw-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="scw-lightbox-panel"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="scw-lightbox-head">
              <p id={titleId} className="scw-lightbox-title">
                {attachment.name}
              </p>
              <button
                type="button"
                className="scw-icon-btn"
                onClick={onClose}
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="scw-lightbox-stage">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
            <p className="scw-lightbox-note">Secure in-browser preview · no download</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
