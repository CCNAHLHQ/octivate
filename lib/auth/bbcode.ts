/**
 * MyBB-style BBCode → safe HTML.
 * Escape raw HTML first, then allow only a tight whitelist of tags/attrs.
 */

const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/;
const SIZE_RE = /^[1-7]$/;
const URL_RE = /^https?:\/\/[^\s<>"']+$/i;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!URL_RE.test(url)) return null;
  if (/^(javascript|data|vbscript):/i.test(url)) return null;
  return url;
}

/** Strip disallowed BBCode / control chars and enforce max length. */
export function sanitizeBbcodeSource(input: string, maxChars: number): string {
  return String(input || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .slice(0, Math.max(0, maxChars));
}

/**
 * Convert BBCode to HTML for display. Output is safe for dangerouslySetInnerHTML.
 */
export function bbcodeToSafeHtml(source: string): string {
  let text = escapeHtml(source).replace(/\r\n/g, "\n");

  // [code] blocks first (no further parsing inside)
  text = text.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (_m, body: string) => {
    return `<pre class="bb-code"><code>${body.trim()}</code></pre>`;
  });

  // [url=...]...[/url] and [url]...[/url]
  text = text.replace(
    /\[url=((?:https?:\/\/)[^\]]+)\]([\s\S]*?)\[\/url\]/gi,
    (_m, href: string, label: string) => {
      const safe = safeUrl(href.replace(/&amp;/g, "&"));
      if (!safe) return label;
      return `<a class="bb-url" href="${escapeHtml(safe)}" rel="noopener noreferrer nofollow" target="_blank">${label || escapeHtml(safe)}</a>`;
    }
  );
  text = text.replace(/\[url\]((?:https?:\/\/)[^\[]+)\[\/url\]/gi, (_m, href: string) => {
    const safe = safeUrl(href.replace(/&amp;/g, "&"));
    if (!safe) return href;
    return `<a class="bb-url" href="${escapeHtml(safe)}" rel="noopener noreferrer nofollow" target="_blank">${escapeHtml(safe)}</a>`;
  });

  // [img]https...[/img]
  text = text.replace(/\[img\]((?:https?:\/\/)[^\[]+)\[\/img\]/gi, (_m, src: string) => {
    const safe = safeUrl(src.replace(/&amp;/g, "&"));
    if (!safe) return "";
    return `<img class="bb-img" src="${escapeHtml(safe)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`;
  });

  // [quote] / [quote=name]
  text = text.replace(
    /\[quote(?:=([^\]]+))?\]([\s\S]*?)\[\/quote\]/gi,
    (_m, who: string | undefined, body: string) => {
      const cite = who
        ? `<cite class="bb-quote-cite">${who.trim()}</cite>`
        : "";
      return `<blockquote class="bb-quote">${cite}${body.trim()}</blockquote>`;
    }
  );

  // Lists
  text = text.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_m, body: string) => {
    const items = body
      .split(/\[\*\]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `<li>${s}</li>`)
      .join("");
    return `<ul class="bb-list">${items}</ul>`;
  });

  // Inline formatting
  text = text.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>");
  text = text.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>");
  text = text.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>");
  text = text.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<s>$1</s>");

  text = text.replace(
    /\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi,
    (_m, color: string, body: string) => {
      const c = color.trim();
      if (!COLOR_RE.test(c)) return body;
      return `<span style="color:${c}">${body}</span>`;
    }
  );

  text = text.replace(
    /\[size=([1-7])\]([\s\S]*?)\[\/size\]/gi,
    (_m, size: string, body: string) => {
      if (!SIZE_RE.test(size)) return body;
      const px = 12 + Number(size) * 2;
      return `<span style="font-size:${px}px">${body}</span>`;
    }
  );

  // Strip any remaining unknown BBCode tags (keep inner text)
  text = text.replace(/\[\/?[a-z0-9*=#\-]+[^\]]*\]/gi, "");

  return text.replace(/\n/g, "<br/>");
}
