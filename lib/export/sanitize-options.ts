import sanitizeHtml from "sanitize-html";

/**
 * Sanitizer profile for operator-authored export templates.
 * Permissive enough for embedded logos (data URIs), rich CSS, and full HTML documents.
 * Scripts/iframes are stripped; everything else is preserved.
 */
export const EXPORT_TEMPLATE_SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: false,
  allowedAttributes: false,
  allowedSchemes: ["http", "https", "mailto", "data"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
    source: ["http", "https", "data"],
    link: ["http", "https", "data"],
  },
  allowVulnerableTags: true,
  /** Preserve complex author CSS (data-URI backgrounds, backdrop-filter, gradients, etc.). */
  parseStyleAttributes: false,
  exclusiveFilter: (frame) =>
    frame.tag === "script" || frame.tag === "iframe" || frame.tag === "object" || frame.tag === "embed",
};

export function sanitizeExportTemplateHtml(html: string): string {
  return sanitizeHtml(html, EXPORT_TEMPLATE_SANITIZE_OPTS);
}
