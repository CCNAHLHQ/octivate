import { promises as fs } from "fs";
import path from "path";
import { atomicWriteJson, createAsyncMutex } from "@/lib/parliamentary/atomic-json";
import { mediaIndexDir } from "@/lib/parliamentary/paths";
import {
  SOURCES_REV,
  VERIFIED_SOURCES,
  inferSourceKind,
  isObsoleteSourceUrl,
  normalizeSourceUrl,
} from "@/lib/parliamentary/sources";
import type {
  CountryCode,
  CrawlSeed,
  MediaCandidate,
  MediaJob,
  PipelineControlState,
  PipelineState,
  PipelineSummary,
} from "@/lib/parliamentary/types";
import { estimateAsrSeconds } from "@/lib/parliamentary/estimate";
import { uid } from "@/lib/store/json-store";

const withJobsLock = createAsyncMutex();

async function ensureDir() {
  await fs.mkdir(mediaIndexDir(), { recursive: true });
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  await ensureDir();
  const file = path.join(mediaIndexDir(), name);
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    await atomicWriteJson(file, fallback);
    return fallback;
  }
}

async function writeJson<T>(name: string, data: T) {
  await ensureDir();
  await atomicWriteJson(path.join(mediaIndexDir(), name), data);
}

function defaultPipeline(): PipelineState {
  return { control: "idle", discoverDone: false, updatedAt: new Date().toISOString() };
}

type SeedsMeta = { rev: number };

function defaultSeeds(): CrawlSeed[] {
  const now = new Date().toISOString();
  return VERIFIED_SOURCES.map((s) => ({
    id: uid("seed"),
    url: s.url,
    label: s.label,
    country: s.country,
    enabled: s.enabled !== false,
    kind: s.kind,
    notes: s.notes,
    createdAt: now,
    updatedAt: now,
  }));
}

/** Reconcile on-disk seeds to verified BB/GY Vimeo sources; drop TT/JM/YouTube leftovers. */
export async function syncVerifiedSources(opts?: {
  force?: boolean;
  keepCustom?: boolean;
}): Promise<CrawlSeed[]> {
  const existing = await readJson<CrawlSeed[]>("seeds.json", []);
  const meta = await readJson<SeedsMeta>("sources-meta.json", { rev: 0 });
  const force = opts?.force === true || meta.rev < SOURCES_REV;
  const keepCustom = opts?.keepCustom !== false;

  if (!force && existing.length && meta.rev >= SOURCES_REV) {
    // Still strip obsolete if any slipped in
    const cleaned = existing.filter((s) => !isObsoleteSourceUrl(s.url));
    if (cleaned.length !== existing.length) {
      await writeJson("seeds.json", cleaned);
      return cleaned;
    }
    return existing;
  }

  const now = new Date().toISOString();
  const byUrl = new Map(
    existing.map((s) => [normalizeSourceUrl(s.url), s] as const)
  );
  const next: CrawlSeed[] = [];

  for (const src of VERIFIED_SOURCES) {
    const key = normalizeSourceUrl(src.url);
    const prev = byUrl.get(key);
    next.push({
      id: prev?.id || uid("seed"),
      url: src.url,
      label: src.label,
      country: src.country,
      enabled: prev ? prev.enabled : src.enabled !== false,
      kind: src.kind,
      notes: src.notes,
      createdAt: prev?.createdAt || now,
      updatedAt: now,
    });
    byUrl.delete(key);
  }

  if (keepCustom) {
    for (const [, s] of byUrl) {
      if (isObsoleteSourceUrl(s.url)) continue;
      next.push({
        ...s,
        url: normalizeSourceUrl(s.url),
        kind: s.kind || inferSourceKind(s.url),
        updatedAt: now,
      });
    }
  }

  await writeJson("seeds.json", next);
  await writeJson("sources-meta.json", { rev: SOURCES_REV });
  return next;
}

export async function readPipeline() {
  return readJson("pipeline.json", defaultPipeline());
}
export async function writePipeline(state: PipelineState) {
  await writeJson("pipeline.json", { ...state, updatedAt: new Date().toISOString() });
}
export async function setPipelineControl(
  control: PipelineControlState,
  patch?: Partial<PipelineState>
) {
  const cur = await readPipeline();
  const next: PipelineState = {
    ...cur,
    ...patch,
    control,
    updatedAt: new Date().toISOString(),
    startedAt:
      control === "running" && cur.control !== "running"
        ? new Date().toISOString()
        : cur.startedAt,
  };
  await writePipeline(next);
  return next;
}

export async function readSeeds(): Promise<CrawlSeed[]> {
  return syncVerifiedSources();
}

/** Replace sources with the verified BB/GY set only. */
export async function resetVerifiedSources(): Promise<CrawlSeed[]> {
  await writeJson("sources-meta.json", { rev: 0 });
  return syncVerifiedSources({ force: true, keepCustom: false });
}
export async function writeSeeds(seeds: CrawlSeed[]) {
  await writeJson("seeds.json", seeds);
}
export async function listEnabledSeeds() {
  return (await readSeeds()).filter((s) => s.enabled);
}
export async function upsertSeed(
  input: Partial<CrawlSeed> & { url: string }
): Promise<CrawlSeed> {
  const seeds = await readSeeds();
  const now = new Date().toISOString();
  let url: URL;
  try {
    url = new URL(input.url.trim());
  } catch {
    throw new Error("invalid_url");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("invalid_url");
  const href = url.href;
  const idx = input.id
    ? seeds.findIndex((s) => s.id === input.id)
    : seeds.findIndex((s) => s.url === href);
  if (idx >= 0) {
    seeds[idx] = {
      ...seeds[idx],
      ...input,
      id: seeds[idx].id,
      url: href,
      updatedAt: now,
    };
    await writeSeeds(seeds);
    return seeds[idx];
  }
  const created: CrawlSeed = {
    id: uid("seed"),
    url: href,
    label: input.label?.trim() || url.hostname.replace(/^www\./, ""),
    country: (input.country || guessCountry(href)) as CountryCode,
    enabled: input.enabled !== false,
    kind: input.kind || (href.includes("vimeo.com") ? "vimeo_showcase" : "site_pages"),
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  seeds.push(created);
  await writeSeeds(seeds);
  return created;
}
export async function removeSeed(id: string) {
  const seeds = await readSeeds();
  const next = seeds.filter((s) => s.id !== id);
  if (next.length === seeds.length) return false;
  await writeSeeds(next);
  return true;
}

function guessCountry(url: string): CountryCode {
  const h = url.toLowerCase();
  if (h.includes("barbados") || h.includes("barbadosparliament")) return "BB";
  if (h.includes("guyana") || h.includes("parliament.gov.gy")) return "GY";
  if (h.includes("ttparliament") || h.includes("trinidad")) return "TT";
  if (h.includes("jamaica") || h.includes("japarliament")) return "JM";
  return "BB";
}

export async function readCandidates() {
  return readJson<MediaCandidate[]>("candidates.json", []);
}
export async function writeCandidates(items: MediaCandidate[]) {
  await writeJson("candidates.json", items);
}
export async function upsertCandidate(c: MediaCandidate) {
  const items = await readCandidates();
  const idx = items.findIndex(
    (x) => x.mediaUrl === c.mediaUrl || (c.vimeoId && x.vimeoId === c.vimeoId)
  );
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...c, id: items[idx].id };
    await writeCandidates(items);
    return items[idx];
  }
  items.push(c);
  await writeCandidates(items);
  return c;
}

export async function readJobs() {
  return withJobsLock(async () => readJson<MediaJob[]>("jobs.json", []));
}
export async function writeJobs(jobs: MediaJob[]) {
  return withJobsLock(async () => {
    await writeJson("jobs.json", jobs);
  });
}
export async function patchJob(id: string, patch: Partial<MediaJob>) {
  return withJobsLock(async () => {
    const jobs = await readJson<MediaJob[]>("jobs.json", []);
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx < 0) return null;
    jobs[idx] = { ...jobs[idx], ...patch, updatedAt: new Date().toISOString() };
    await writeJson("jobs.json", jobs);
    return jobs[idx];
  });
}

/** Promote first `batchSize` open held/new candidates to queued; remainder stay held. */
export async function applyBatchQueue(batchSize: number) {
  return withJobsLock(async () => {
    const candidates = await readJson<MediaCandidate[]>("candidates.json", []);
    const jobs = await readJson<MediaJob[]>("jobs.json", []);
    const sorted = [...candidates].sort(
      (a, b) => Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt)
    );
    let queued = 0;
    let held = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      const stage = i < batchSize ? "queued" : "held";
      const existingIdx = jobs.findIndex(
        (j) => j.mediaUrl === c.mediaUrl || j.candidateId === c.id
      );
      if (existingIdx >= 0) {
        const existing = jobs[existingIdx];
        if (
          (existing.stage === "held" || existing.stage === "queued") &&
          existing.stage !== stage &&
          (stage === "held" || stage === "queued")
        ) {
          jobs[existingIdx] = {
            ...existing,
            stage,
            progressPct: 0,
            updatedAt: now,
          };
        }
      } else {
        const estimateAsrSec = estimateAsrSeconds(c.durationSec);
        jobs.push({
          id: uid("parljob"),
          candidateId: c.id,
          country: c.country,
          title: c.title,
          pageUrl: c.pageUrl,
          mediaUrl: c.mediaUrl,
          platform: c.platform,
          vimeoId: c.vimeoId,
          stage,
          progressPct: 0,
          progressPhase: "idle",
          retryCount: 0,
          createdAt: now,
          updatedAt: now,
          durationSec: c.durationSec,
          estimateAsrSec,
          estimateTotalSec: estimateAsrSec + 90,
          warnings: [...c.warnings],
        });
      }
      if (stage === "queued") queued += 1;
      else held += 1;
    }
    await writeJson("jobs.json", jobs);
    return { queued, held, total: sorted.length, batchSize };
  });
}

export type ParlProgressSnapshot = {
  stage: string;
  current?: string;
  total: number;
  done: number;
  failed: number;
  updatedAt: string;
  message?: string;
};

export async function readProgress() {
  return readJson<ParlProgressSnapshot>("progress.json", {
    stage: "idle",
    total: 0,
    done: 0,
    failed: 0,
    updatedAt: new Date().toISOString(),
  });
}
export async function writeProgress(
  snap: Partial<ParlProgressSnapshot> & { stage: string }
) {
  const cur = await readProgress();
  const next = { ...cur, ...snap, updatedAt: new Date().toISOString() };
  await writeJson("progress.json", next);
  return next;
}

export async function getSummary(): Promise<PipelineSummary> {
  const { readSettings } = await import("@/lib/parliamentary/settings");
  const [pipeline, candidates, jobs, seeds, settings] = await Promise.all([
    readPipeline(),
    readCandidates(),
    readJobs(),
    readSeeds(),
    readSettings(),
  ]);
  const count = (stage: MediaJob["stage"]) => jobs.filter((j) => j.stage === stage).length;
  const downloading = count("downloading");
  const downloaded = count("downloaded");
  const transcribing = count("transcribing");
  const estimateAsrSec = jobs
    .filter((j) =>
      ["queued", "downloading", "downloaded", "transcribing"].includes(j.stage)
    )
    .reduce((sum, j) => sum + (j.estimateAsrSec || estimateAsrSeconds(j.durationSec)), 0);
  return {
    control: pipeline.control,
    found: candidates.length,
    held: count("held"),
    queued: count("queued"),
    downloading,
    downloaded,
    transcribing,
    done: count("done"),
    failed: count("failed"),
    cancelled: count("cancelled"),
    active: downloading + downloaded + transcribing,
    jobs: jobs.length,
    seedsEnabled: seeds.filter((s) => s.enabled).length,
    seedsTotal: seeds.length,
    estimateAsrSec,
    batchSize: settings.batchSize,
    discoverDone: pipeline.discoverDone,
    lastError: pipeline.lastError,
    updatedAt: new Date().toISOString(),
  };
}
