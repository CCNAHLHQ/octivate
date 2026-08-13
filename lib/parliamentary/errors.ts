/** Human-readable failure summaries for Automation UI / job records. */

export type ParlErrorSummary = {
  code: string;
  headline: string;
  detail: string;
};

const NOISE =
  /^(Warning:|You are sending unauthenticated|Please set a HF_TOKEN|Traceback \(most recent|File \".+|^\s*~+\^?\s*$|sys\.exit\()/i;

export function summarizeParlError(raw: string | undefined | null): ParlErrorSummary {
  const detail = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (!detail) {
    return { code: "unknown", headline: "Unknown failure", detail: "" };
  }

  const codeMatch = detail.match(/^([a-z][a-z0-9_]{2,40})\s*:/i);
  const code = (codeMatch?.[1] || "error").toLowerCase();
  const body = codeMatch ? detail.slice(codeMatch[0].length).trim() : detail;
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const signal =
    [...lines]
      .reverse()
      .find(
        (l) =>
          !NOISE.test(l) &&
          (/Error:|Exception|failed|ENOENT|EPERM|Timeout|OOM|CUDA|out of memory|ModuleNotFound/i.test(
            l
          ) ||
            l.length < 160)
      ) ||
    lines.find((l) => !NOISE.test(l)) ||
    lines[0] ||
    code;

  let headline = signal.replace(/^asr_failed:/i, "").trim();
  if (code === "asr_failed" && !/asr/i.test(headline)) {
    headline = `ASR · ${headline}`;
  } else if (code === "vimeo_cdn_not_found") {
    headline = "Vimeo CDN URL not captured";
  } else if (code === "cancelled_by_operator") {
    headline = "Cancelled by operator";
  }

  if (headline.length > 140) headline = `${headline.slice(0, 137)}…`;

  return {
    code,
    headline: headline || code,
    detail: detail.length > 12_000 ? `${detail.slice(0, 12_000)}\n…[truncated]` : detail,
  };
}

export function shortUrl(url: string | undefined | null, max = 42): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const path = `${u.pathname}${u.search}`.replace(/\/$/, "") || "/";
    const compact = `${u.host}${path.length > 28 ? `${path.slice(0, 25)}…` : path}`;
    return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
  } catch {
    return url.length > max ? `${url.slice(0, max - 1)}…` : url;
  }
}
