import { parseCsv } from "@/lib/sources/parse-csv";
import { readCollection, uid, writeCollection } from "@/lib/store/json-store";
import type { MailingSubscriber } from "@/lib/types";

export type MailingImportRow = { email: string; name?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeMailingEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isMailingEmail(value: string): boolean {
  return EMAIL_RE.test(normalizeMailingEmail(value));
}

function pickEmailName(row: Record<string, string>): MailingImportRow | null {
  const keys = Object.keys(row);
  const lower = Object.fromEntries(keys.map((k) => [k.toLowerCase().trim(), row[k]]));
  const email =
    lower.email ||
    lower["e-mail"] ||
    lower.mail ||
    lower.address ||
    lower["email address"] ||
    "";
  const name =
    lower.name ||
    lower["full name"] ||
    lower.fullname ||
    lower["display name"] ||
    undefined;
  const cleaned = normalizeMailingEmail(email);
  if (!isMailingEmail(cleaned)) return null;
  const n = name?.trim();
  return n ? { email: cleaned, name: n } : { email: cleaned };
}

/** Parse CSV / TSV / TXT / JSON mailing lists into unique email rows. */
export function parseMailingImportText(
  text: string,
  filename = "upload"
): MailingImportRow[] {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];

  const lower = filename.toLowerCase();
  const out: MailingImportRow[] = [];
  const seen = new Set<string>();

  const push = (row: MailingImportRow | null) => {
    if (!row) return;
    if (seen.has(row.email)) return;
    seen.add(row.email);
    out.push(row);
  };

  if (lower.endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed) as unknown;
      const rows = Array.isArray(data) ? data : [data];
      for (const item of rows) {
        if (typeof item === "string") {
          push(isMailingEmail(item) ? { email: normalizeMailingEmail(item) } : null);
          continue;
        }
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const email = String(obj.email || obj.mail || obj.address || "");
          const name = obj.name != null ? String(obj.name) : undefined;
          push(
            isMailingEmail(email)
              ? {
                  email: normalizeMailingEmail(email),
                  name: name?.trim() || undefined,
                }
              : null
          );
        }
      }
      return out;
    } catch {
      /* fall through to line / csv parsers */
    }
  }

  if (lower.endsWith(".txt") || (!lower.includes(".") && !trimmed.includes(","))) {
    const lines = trimmed.split(/\r?\n/);
    const looksLikeCsv =
      lines[0]?.toLowerCase().includes("email") ||
      (lines[0]?.includes(",") && lines.some((l) => l.includes("@") && l.includes(",")));
    if (!looksLikeCsv) {
      for (const line of lines) {
        const raw = line.split(/[;,\t]/)[0]?.trim() || "";
        if (!raw || raw.startsWith("#")) continue;
        push(isMailingEmail(raw) ? { email: normalizeMailingEmail(raw) } : null);
      }
      if (out.length) return out;
    }
  }

  const table = parseCsv(trimmed);
  if (!table.length) return out;

  const header = table[0].map((c) => c.trim().toLowerCase());
  const hasHeader = header.some((h) =>
    ["email", "e-mail", "mail", "address", "email address", "name"].includes(h)
  );

  if (hasHeader) {
    for (const cells of table.slice(1)) {
      const row: Record<string, string> = {};
      header.forEach((h, i) => {
        row[h] = cells[i] || "";
      });
      push(pickEmailName(row));
    }
    return out;
  }

  for (const cells of table) {
    const emailCell = cells.find((c) => isMailingEmail(c)) || cells[0] || "";
    const nameCell = cells.find((c, i) => i > 0 && c.trim() && !isMailingEmail(c));
    push(
      isMailingEmail(emailCell)
        ? {
            email: normalizeMailingEmail(emailCell),
            name: nameCell?.trim() || undefined,
          }
        : null
    );
  }

  return out;
}

export async function importMailingSubscribers(
  rows: MailingImportRow[]
): Promise<{ added: number; updated: number; skipped: number; total: number }> {
  const list = await readCollection<MailingSubscriber>("mailing-list", []);
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = normalizeMailingEmail(row.email);
    if (!isMailingEmail(email)) {
      skipped += 1;
      continue;
    }
    const existing = list.find((s) => s.email === email);
    if (existing) {
      existing.status = "active";
      existing.name = row.name?.trim() || existing.name;
      existing.unsubscribedAt = undefined;
      existing.updatedAt = now;
      if (!existing.consentedAt) existing.consentedAt = now;
      updated += 1;
      continue;
    }
    list.push({
      id: uid("mail"),
      email,
      name: row.name?.trim() || undefined,
      source: "import",
      status: "active",
      consentedAt: now,
      updatedAt: now,
    });
    added += 1;
  }

  await writeCollection("mailing-list", list);
  const total = list.filter((s) => s.status !== "unsubscribed").length;
  return { added, updated, skipped, total };
}
