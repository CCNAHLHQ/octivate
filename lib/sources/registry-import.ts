import { promises as fs } from "fs";
import path from "path";
import { readCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_SOURCES } from "@/lib/mock/seed";
import { csvToObjects } from "@/lib/sources/parse-csv";
import {
  normalizeSourceUrl,
  registryRowToSource,
} from "@/lib/sources/registry-map";
import type { Source } from "@/lib/types";

export const DEFAULT_REGISTRY_CSV = path.join(
  process.cwd(),
  "data",
  "local",
  "source-registry.csv"
);

export type RegistryImportReport = {
  path: string;
  rows: number;
  upserted: number;
  created: number;
  updated: number;
  sources: Source[];
};

function indexByUrl(sources: Source[]): Map<string, number> {
  const map = new Map<string, number>();
  sources.forEach((s, i) => {
    const key = normalizeSourceUrl(s.url);
    if (key) map.set(key, i);
  });
  return map;
}

/** Parse CSV text into Source catalog rows (no persistence). */
export function sourcesFromRegistryCsv(csvText: string, importedAt = new Date().toISOString()): Source[] {
  const rows = csvToObjects(csvText);
  return rows
    .filter((r) => (r.source_name || "").trim())
    .map((r) => registryRowToSource(r, importedAt));
}

/**
 * Upsert registry sources into the sources collection.
 * Match key: normalized source_url; fallback: id.
 */
export async function importRegistryCsv(
  csvText: string,
  opts: { persist?: boolean; replaceAll?: boolean } = {}
): Promise<RegistryImportReport> {
  const persist = opts.persist !== false;
  const importedAt = new Date().toISOString();
  const incoming = sourcesFromRegistryCsv(csvText, importedAt);

  let existing = opts.replaceAll
    ? []
    : await readCollection<Source>("sources", SEED_SOURCES);

  // Drop thin seed stubs once registry data arrives (keep any non-registry extras without urls only if not replaceAll)
  if (!opts.replaceAll && incoming.length > 0) {
    const seedIds = new Set(SEED_SOURCES.map((s) => s.id));
    const hasRegistry = existing.some((s) => s.registryImportedAt || s.totalSourceScore != null);
    if (!hasRegistry) {
      existing = existing.filter((s) => !seedIds.has(s.id));
    }
  }

  const byUrl = indexByUrl(existing);
  const byId = new Map(existing.map((s, i) => [s.id, i]));
  let created = 0;
  let updated = 0;

  for (const src of incoming) {
    const urlKey = normalizeSourceUrl(src.url);
    const idx =
      (urlKey ? byUrl.get(urlKey) : undefined) ?? byId.get(src.id);
    if (typeof idx === "number") {
      const prev = existing[idx];
      existing[idx] = {
        ...prev,
        ...src,
        id: prev.id.startsWith("src_") ? prev.id : src.id,
        health: prev.health || src.health,
      };
      updated += 1;
      if (urlKey) byUrl.set(urlKey, idx);
      byId.set(existing[idx].id, idx);
    } else {
      existing.push(src);
      created += 1;
      const newIdx = existing.length - 1;
      if (urlKey) byUrl.set(urlKey, newIdx);
      byId.set(src.id, newIdx);
    }
  }

  // Prefer registry order by score desc for stable UX
  existing.sort((a, b) => (b.totalSourceScore ?? 0) - (a.totalSourceScore ?? 0));

  if (persist) {
    await writeCollection("sources", existing);
  }

  return {
    path: DEFAULT_REGISTRY_CSV,
    rows: incoming.length,
    upserted: created + updated,
    created,
    updated,
    sources: existing,
  };
}

export async function importRegistryFromPath(
  filePath = DEFAULT_REGISTRY_CSV,
  opts?: { persist?: boolean; replaceAll?: boolean }
): Promise<RegistryImportReport> {
  const csvText = await fs.readFile(filePath, "utf8");
  const report = await importRegistryCsv(csvText, opts);
  return { ...report, path: filePath };
}

export type RegistryCsvBatchInput = {
  name: string;
  csv: string;
};

export type RegistryBatchImportReport = RegistryImportReport & {
  files: string[];
  fileReports: { name: string; rows: number; created: number; updated: number; error?: string }[];
};

/**
 * Import one or more CSV texts into the registry.
 * First file may replaceAll; subsequent files always merge/upsert.
 */
export async function importRegistryCsvBatch(
  files: RegistryCsvBatchInput[],
  opts: { persist?: boolean; replaceAll?: boolean } = {}
): Promise<RegistryBatchImportReport> {
  if (!files.length) {
    throw new Error("At least one CSV file is required");
  }

  let created = 0;
  let updated = 0;
  let rows = 0;
  let sources: Source[] = [];
  const fileReports: RegistryBatchImportReport["fileReports"] = [];
  const names: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    names.push(file.name);
    const text = (file.csv || "").replace(/^\uFEFF/, "").trim();
    if (!text) {
      fileReports.push({
        name: file.name,
        rows: 0,
        created: 0,
        updated: 0,
        error: "Empty CSV",
      });
      continue;
    }
    try {
      const report = await importRegistryCsv(text, {
        persist: opts.persist,
        // Only the first successful file may wipe; later files merge.
        replaceAll: i === 0 ? Boolean(opts.replaceAll) : false,
      });
      created += report.created;
      updated += report.updated;
      rows += report.rows;
      sources = report.sources;
      fileReports.push({
        name: file.name,
        rows: report.rows,
        created: report.created,
        updated: report.updated,
      });
    } catch (err) {
      fileReports.push({
        name: file.name,
        rows: 0,
        created: 0,
        updated: 0,
        error: err instanceof Error ? err.message : "Parse failed",
      });
    }
  }

  if (!fileReports.some((f) => !f.error && f.rows >= 0) && fileReports.every((f) => f.error)) {
    throw new Error(fileReports.map((f) => `${f.name}: ${f.error}`).join("; ") || "Import failed");
  }

  // If every file failed with empty/parse but some had 0 rows without error, still ok
  if (!sources.length && opts.persist !== false) {
    sources = await readCollection<Source>("sources", SEED_SOURCES);
  }

  return {
    path: names.join(", "),
    files: names,
    rows,
    created,
    updated,
    upserted: created + updated,
    sources,
    fileReports,
  };
}

/** Copy an external CSV into the canonical local registry path, then import. */
export async function installAndImportRegistry(
  sourceCsvPath: string,
  opts?: { persist?: boolean; replaceAll?: boolean }
): Promise<RegistryImportReport> {
  await fs.mkdir(path.dirname(DEFAULT_REGISTRY_CSV), { recursive: true });
  await fs.copyFile(sourceCsvPath, DEFAULT_REGISTRY_CSV);
  return importRegistryFromPath(DEFAULT_REGISTRY_CSV, { replaceAll: true, ...opts });
}
