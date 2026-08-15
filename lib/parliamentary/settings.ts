import {
  asrProviderDefault,
  batchDefault,
  batchHardCap,
  maxRetriesDefault,
} from "@/lib/parliamentary/config";
import { atomicWriteJson } from "@/lib/parliamentary/atomic-json";
import { mediaIndexDir } from "@/lib/parliamentary/paths";
import type { AutomationSettings, AsrProvider } from "@/lib/parliamentary/types";
import { promises as fs } from "fs";
import path from "path";

function clampBatch(n: number) {
  const hard = batchHardCap();
  return Math.max(1, Math.min(hard, Math.floor(n)));
}

export function defaultSettings(): AutomationSettings {
  return {
    batchSize: clampBatch(batchDefault()),
    maxRetries: maxRetriesDefault(),
    asrProvider: asrProviderDefault(),
    updatedAt: new Date().toISOString(),
  };
}

async function persist(settings: AutomationSettings) {
  await atomicWriteJson(path.join(mediaIndexDir(), "settings.json"), settings);
}

export async function readSettings(): Promise<AutomationSettings> {
  const file = path.join(mediaIndexDir(), "settings.json");
  try {
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as Partial<AutomationSettings>;
    const base = defaultSettings();
    return {
      batchSize: clampBatch(Number(raw.batchSize ?? base.batchSize)),
      maxRetries: Math.max(0, Math.min(8, Number(raw.maxRetries ?? base.maxRetries) || 0)),
      asrProvider: (["auto", "openrouter", "local"].includes(String(raw.asrProvider))
        ? raw.asrProvider
        : base.asrProvider) as AsrProvider,
      updatedAt: raw.updatedAt || base.updatedAt,
    };
  } catch {
    const d = defaultSettings();
    await persist(d);
    return d;
  }
}

export async function writeSettings(
  patch: Partial<AutomationSettings>
): Promise<AutomationSettings> {
  let cur: AutomationSettings;
  try {
    cur = await readSettings();
  } catch {
    cur = defaultSettings();
  }
  const next: AutomationSettings = {
    batchSize: clampBatch(Number(patch.batchSize ?? cur.batchSize)),
    maxRetries: Math.max(
      0,
      Math.min(8, Number(patch.maxRetries ?? cur.maxRetries) || 0)
    ),
    asrProvider: (["auto", "openrouter", "local"].includes(
      String(patch.asrProvider ?? cur.asrProvider)
    )
      ? (patch.asrProvider ?? cur.asrProvider)
      : cur.asrProvider) as AsrProvider,
    updatedAt: new Date().toISOString(),
  };
  await persist(next);
  return next;
}
