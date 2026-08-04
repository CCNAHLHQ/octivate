"use client";

import { useEffect, useRef } from "react";
import { MousePointerClick } from "lucide-react";

/**
 * Renders the raw template HTML in an isolated iframe and makes it directly
 * click-to-editable (via the same-origin document's designMode). Edits are
 * serialized back to the HTML source and streamed out through `onHtmlChange`
 * (debounced), so the live preview + autosave update in real time.
 *
 * The iframe is seeded once from the initial `htmlBody`; subsequent prop
 * changes do NOT re-seed it (that would reset the caret). Parent forces a
 * fresh seed by changing this component's `key`.
 */
export function ExportTemplateVisualEditor({
  htmlBody,
  onHtmlChange,
  onCommit,
}: {
  htmlBody: string;
  onHtmlChange: (value: string) => void;
  onCommit?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const seed = useRef(htmlBody);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadDoctype = /<!doctype/i.test(seed.current);

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  function handleLoad() {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    try {
      doc.designMode = "on";
    } catch {
      /* designMode unsupported — fall back to read-only preview */
    }

    // Editing affordances injected from the parent (no script runs in-frame).
    const style = doc.createElement("style");
    style.setAttribute("data-octivate-edit", "");
    style.textContent = `
      body { cursor: text; caret-color: #8b5cf6; }
      ::selection { background: rgba(168,85,247,0.28); }
      [contenteditable]:focus, body:focus { outline: none; }
    `;
    doc.head?.appendChild(style);

    const serialize = () => {
      const inner = doc.documentElement?.outerHTML ?? "";
      const cleaned = inner.replace(
        /<style data-octivate-edit[^>]*>[\s\S]*?<\/style>/i,
        ""
      );
      return (hadDoctype ? "<!DOCTYPE html>\n" : "") + cleaned;
    };

    doc.addEventListener("input", () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => onHtmlChange(serialize()), 350);
    });

    // Commit (flush autosave) when focus leaves the editable surface.
    doc.addEventListener(
      "blur",
      () => {
        if (debounce.current) clearTimeout(debounce.current);
        onHtmlChange(serialize());
        onCommit?.();
      },
      true
    );
  }

  return (
    <div className="exp-visual-wrap">
      <div className="exp-visual-hint">
        <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
        Click any text to edit — changes update the preview and autosave.
      </div>
      <iframe
        ref={iframeRef}
        title="Visual template editor"
        className="exp-visual-frame"
        srcDoc={seed.current}
        sandbox="allow-same-origin"
        onLoad={handleLoad}
      />
    </div>
  );
}
