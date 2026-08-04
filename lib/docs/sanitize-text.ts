/**
 * Hard security stance for anything that may reach the browser or a model:
 * strip scripts, event handlers, data URIs that look executable, and control chars.
 */

const SCRIPTISH =
  /<\s*(script|iframe|object|embed|link|meta|base|form|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const TAGS = /<\/?[a-zA-Z][^>]*>/g;
const ON_ATTR = /\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URI = /javascript\s*:/gi;
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Plain-text sanitize for summaries / extracted content shown in UI. */
export function sanitizePlainText(input: string, maxLen = 24_000): string {
  let s = String(input ?? "");
  s = s.replace(SCRIPTISH, " ");
  s = s.replace(ON_ATTR, " ");
  s = s.replace(JS_URI, "");
  s = s.replace(TAGS, " ");
  s = s.replace(CTRL, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen) + "…";
  return s;
}

/** Cap + sanitize model JSON string fields before persisting or returning. */
export function sanitizeModelStrings<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string") out[k] = sanitizePlainText(v, 8_000);
    else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        typeof item === "string"
          ? sanitizePlainText(item, 4_000)
          : item && typeof item === "object"
            ? sanitizeModelStrings(item as Record<string, unknown>)
            : item
      );
    } else if (v && typeof v === "object") {
      out[k] = sanitizeModelStrings(v as Record<string, unknown>);
    }
  }
  return out as T;
}
