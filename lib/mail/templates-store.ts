import { readCollection, removeFromCollection, writeCollection } from "@/lib/store/json-store";

export type MailTemplateKind =
  | "announcement"
  | "invite"
  | "newsletter"
  | "update"
  | "custom";

export type MailTemplate = {
  id: string;
  name: string;
  description?: string;
  kind: MailTemplateKind | string;
  subject: string;
  preheader?: string;
  eyebrow?: string;
  text: string;
  bullets?: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  signOff?: string;
  signOffRole?: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const STORE = "mail-templates";

export function sortMailTemplates(items: MailTemplate[]) {
  return [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
  );
}

export async function listMailTemplates() {
  return sortMailTemplates(await readCollection<MailTemplate>(STORE, []));
}

export async function findMailTemplate(id: string) {
  const items = await listMailTemplates();
  return items.find((t) => t.id === id) ?? null;
}

export type MailTemplatePatch = Partial<
  Omit<MailTemplate, "id" | "createdAt" | "updatedAt">
>;

export async function updateMailTemplate(id: string, patch: MailTemplatePatch) {
  const items = await listMailTemplates();
  const idx = items.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  items[idx] = { ...items[idx], ...patch, id, updatedAt: now };
  await writeCollection(STORE, items);
  return items[idx];
}

export async function deleteMailTemplate(id: string) {
  const { removed } = await removeFromCollection<MailTemplate>(STORE, id, []);
  return Boolean(removed);
}
