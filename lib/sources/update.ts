import { appendAudit } from "@/lib/protocol/audit";
import { readSourcesCollection, writeSourcesCollection } from "@/lib/sources/live-registry";
import { deriveTier } from "@/lib/sources/registry-map";
import type {
  Source,
  SourceBriefUse,
  SourceRetrievalPriority,
  SourceWatchPriority,
} from "@/lib/types";

export type SourcePatch = {
  title?: string;
  country?: string;
  countries?: string[];
  type?: string;
  url?: string | null;
  primaryRetrievalUrl?: string | null;
  dataPublicationsUrl?: string | null;
  sectorTags?: string[];
  psnLayers?: string[];
  userRelevance?: string[];
  evidenceRoles?: string[];
  watchPriority?: SourceWatchPriority;
  retrievalPriority?: SourceRetrievalPriority;
  briefUse?: SourceBriefUse | null;
  humanReviewRequired?: boolean;
  notes?: string | null;
  institutionOwner?: string | null;
  subregion?: string | null;
};

function cleanUrl(v: string | null | undefined): string | undefined {
  if (v === null) return undefined;
  const t = (v || "").trim();
  return t || undefined;
}

function cleanList(v: string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return v.map((s) => s.trim()).filter(Boolean);
}

export async function patchSource(
  id: string,
  patch: SourcePatch
): Promise<Source> {
  const sources = await readSourcesCollection();
  const idx = sources.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Source not found");

  const prev = sources[idx];
  const next: Source = { ...prev };

  if (patch.title !== undefined) next.title = patch.title.trim() || prev.title;
  if (patch.country !== undefined) {
    next.country = patch.country.trim() || prev.country;
    if (!patch.countries) next.countries = [next.country];
  }
  if (patch.countries !== undefined) {
    next.countries = cleanList(patch.countries) || [];
    if (next.countries[0]) next.country = next.countries[0];
  }
  if (patch.type !== undefined) next.type = patch.type.trim() || prev.type;
  if (patch.url !== undefined) next.url = cleanUrl(patch.url);
  if (patch.primaryRetrievalUrl !== undefined) {
    next.primaryRetrievalUrl = cleanUrl(patch.primaryRetrievalUrl);
  }
  if (patch.dataPublicationsUrl !== undefined) {
    next.dataPublicationsUrl = cleanUrl(patch.dataPublicationsUrl);
  }
  if (patch.sectorTags !== undefined) next.sectorTags = cleanList(patch.sectorTags) || [];
  if (patch.psnLayers !== undefined) next.psnLayers = cleanList(patch.psnLayers) || [];
  if (patch.userRelevance !== undefined) {
    next.userRelevance = cleanList(patch.userRelevance) || [];
  }
  if (patch.evidenceRoles !== undefined) {
    next.evidenceRoles = cleanList(patch.evidenceRoles) || [];
  }
  if (patch.watchPriority !== undefined) next.watchPriority = patch.watchPriority;
  if (patch.retrievalPriority !== undefined) {
    next.retrievalPriority = patch.retrievalPriority;
  }
  if (patch.briefUse !== undefined) {
    next.briefUse = patch.briefUse || undefined;
  }
  if (patch.humanReviewRequired !== undefined) {
    next.humanReviewRequired = patch.humanReviewRequired;
  }
  if (patch.notes !== undefined) {
    const t = (patch.notes || "").trim();
    next.notes = t || undefined;
  }
  if (patch.institutionOwner !== undefined) {
    const t = (patch.institutionOwner || "").trim();
    next.institutionOwner = t || undefined;
  }
  if (patch.subregion !== undefined) {
    const t = (patch.subregion || "").trim();
    next.subregion = t || undefined;
  }

  next.tier = deriveTier(
    next.watchPriority,
    next.totalSourceScore ?? 0,
    next.retrievalPriority
  );
  next.lastChecked = new Date().toISOString();

  sources[idx] = next;
  sources.sort(
    (a, b) =>
      (b.totalSourceScore ?? 0) - (a.totalSourceScore ?? 0) ||
      a.title.localeCompare(b.title)
  );
  await writeSourcesCollection(sources);

  await appendAudit({
    action: "source_updated",
    detail: `Updated source "${next.title}" (${next.id})`,
  });

  return next;
}

/** Remove a single source from the live registry (CSV-imported or curated). */
export async function deleteSource(id: string): Promise<{ deleted: Source }> {
  const sources = await readSourcesCollection();
  const idx = sources.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Source not found");

  const [deleted] = sources.splice(idx, 1);
  await writeSourcesCollection(sources);

  await appendAudit({
    action: "source_deleted",
    detail: `Deleted source "${deleted.title}" (${deleted.id})`,
  });

  return { deleted };
}
