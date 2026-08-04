import { BLANK_EXPORT_TEMPLATE_HTML, SEED_EXPORT_TEMPLATES } from "@/lib/export/seed-templates";
import { cleanupTemplateAssets, extractExportPreview } from "@/lib/export/upload";
import { readCollection, removeFromCollection, uid, writeCollection } from "@/lib/store/json-store";
import type { ExportTemplate } from "@/lib/types";

/** Stable ordering: sortOrder first, then creation time as a tiebreaker. */
export function sortTemplates(items: ExportTemplate[]) {
  return [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
  );
}

export async function listExportTemplates() {
  return sortTemplates(await readCollection<ExportTemplate>("export-templates", SEED_EXPORT_TEMPLATES));
}

export async function findExportTemplate(id: string) {
  const items = await listExportTemplates();
  return items.find((t) => t.id === id) ?? null;
}

export async function createExportTemplate(
  input: Partial<ExportTemplate> & Pick<ExportTemplate, "name">
) {
  const items = await listExportTemplates();
  const now = new Date().toISOString();
  const sortOrder = items.length > 0 ? Math.max(...items.map((t) => t.sortOrder)) + 1 : 0;
  const htmlBody = input.htmlBody ?? BLANK_EXPORT_TEMPLATE_HTML;

  const template: ExportTemplate = {
    id: uid("tpl"),
    name: input.name,
    description: input.description,
    subjectPreset: input.subjectPreset ?? "Decision brief",
    campaignSubject: input.campaignSubject,
    htmlBody,
    supportsFormats: input.supportsFormats ?? ["html", "pdf", "docx", "pptx"],
    sortOrder,
    enabled: input.enabled ?? true,
    imported: input.imported ?? false,
    sourceFile: input.sourceFile,
    assetDir: input.assetDir,
    previewText: input.previewText ?? extractExportPreview(htmlBody),
    createdAt: now,
    updatedAt: now,
  };

  items.push(template);
  await writeCollection("export-templates", items);
  return template;
}

export async function updateExportTemplate(id: string, patch: Partial<ExportTemplate>) {
  const items = await listExportTemplates();
  const idx = items.findIndex((t) => t.id === id);
  const now = new Date().toISOString();

  // Keep search text in sync whenever the HTML body changes.
  const derived: Partial<ExportTemplate> =
    patch.htmlBody !== undefined && patch.previewText === undefined
      ? { previewText: extractExportPreview(patch.htmlBody) }
      : {};

  // Seed templates may not be persisted yet — upsert from the seed definition.
  if (idx < 0) {
    const seed = SEED_EXPORT_TEMPLATES.find((t) => t.id === id);
    if (!seed) return null;
    const template: ExportTemplate = { ...seed, ...patch, ...derived, id, updatedAt: now };
    items.push(template);
    await writeCollection("export-templates", items);
    return template;
  }

  items[idx] = { ...items[idx], ...patch, ...derived, id, updatedAt: now };
  await writeCollection("export-templates", items);
  return items[idx];
}

export async function duplicateExportTemplate(id: string) {
  const source = await findExportTemplate(id);
  if (!source) return null;
  // Intentionally omit assetDir/sourceFile so deleting a copy never purges the
  // original's imported assets.
  return createExportTemplate({
    name: `${source.name} (copy)`,
    description: source.description,
    subjectPreset: source.subjectPreset,
    campaignSubject: source.campaignSubject,
    htmlBody: source.htmlBody,
    supportsFormats: source.supportsFormats,
    enabled: source.enabled,
    imported: source.imported,
  });
}

export async function deleteExportTemplate(id: string) {
  const { removed } = await removeFromCollection<ExportTemplate>(
    "export-templates",
    id,
    SEED_EXPORT_TEMPLATES
  );
  if (removed) await cleanupTemplateAssets(id);
  return removed;
}

export async function reorderExportTemplates(order: string[]) {
  const items = await listExportTemplates();
  const map = new Map(items.map((t) => [t.id, t]));
  const next: ExportTemplate[] = [];
  order.forEach((id, i) => {
    const item = map.get(id);
    if (item) next.push({ ...item, sortOrder: i, updatedAt: new Date().toISOString() });
    map.delete(id);
  });
  for (const rest of map.values()) {
    next.push({ ...rest, sortOrder: next.length, updatedAt: new Date().toISOString() });
  }
  await writeCollection("export-templates", next);
  return sortTemplates(next);
}
