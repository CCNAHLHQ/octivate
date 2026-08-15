import { removeFromCollection, readCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_BRIEFS, SEED_MONITORS, SEED_PROJECTS } from "@/lib/mock/seed";
import type {
  AuditLogEntry,
  Brief,
  MailingSubscriber,
  Monitor,
  Project,
} from "@/lib/types";
import {
  MODERATION_COLLECTIONS,
  isModerationReadOnly,
  type ModerationCollection,
  type ModerationRow,
} from "@/lib/moderation/constants";
import { clearFlag, flagKey, readFlags } from "@/lib/moderation/flags";
import type { SupportThread } from "@/lib/support/types";
import { listSessions, removeSession, persistSession } from "@/lib/agents/session-store";
import { readCostLedger, removeCostLedgerEntry } from "@/lib/usage/usage-store";

export {
  MODERATION_COLLECTIONS,
  MODERATION_LABELS,
  isModerationCollection,
  type ModerationCollection,
  type ModerationRow,
} from "@/lib/moderation/constants";

function applyFlags(
  rows: ModerationRow[],
  flags: Awaited<ReturnType<typeof readFlags>>
): ModerationRow[] {
  return rows.map((row) => {
    const f = flags[flagKey(row.collection, row.id)];
    return {
      ...row,
      flagged: !!f?.flagged,
      hidden: !!f?.hidden,
      meta: [
        row.meta,
        f?.flagged ? "flagged" : null,
        f?.hidden ? "hidden" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
}

export async function listModerationInventory(): Promise<
  Record<ModerationCollection, ModerationRow[]>
> {
  const [projects, briefs, monitors, mailing, sessions, costs, audit, support, flags] =
    await Promise.all([
      readCollection<Project>("projects", SEED_PROJECTS),
      readCollection<Brief>("briefs", SEED_BRIEFS),
      readCollection<Monitor>("monitors", SEED_MONITORS),
      readCollection<MailingSubscriber>("mailing-list", []),
      listSessions(),
      readCostLedger(),
      readCollection<AuditLogEntry>("audit-log", []),
      readCollection<SupportThread>("support-threads", []),
      readFlags(),
    ]);

  const base: Record<ModerationCollection, ModerationRow[]> = {
    projects: projects.map((p) => ({
      id: p.id,
      collection: "projects" as const,
      title: p.name,
      meta: `${p.country} · ${p.sector} · ${p.status}`,
      createdAt: p.createdAt,
      href: `/dashboard/projects/${p.id}`,
      detail: p.question || undefined,
    })),
    briefs: briefs.map((b) => ({
      id: b.id,
      collection: "briefs" as const,
      title: b.title,
      meta: `${b.country} · ${b.status} · risk ${b.riskLevel}`,
      createdAt: b.createdAt,
      href: `/dashboard/briefs/${b.id}`,
      detail: b.executiveSummary || undefined,
    })),
    monitors: monitors.map((m) => ({
      id: m.id,
      collection: "monitors" as const,
      title: m.name,
      meta: `${m.status} · ${m.alertCount} alerts`,
      href: `/dashboard/monitors/${m.id}`,
    })),
    "mailing-list": mailing.map((s) => ({
      id: s.id,
      collection: "mailing-list" as const,
      title: s.email,
      meta: `${s.status}${s.name ? ` · ${s.name}` : ""}`,
      createdAt: s.consentedAt,
    })),
    "agent-sessions": sessions.map((s) => ({
      id: s.id,
      collection: "agent-sessions" as const,
      title: s.question,
      meta: `${s.status} · ${s.tokensUsed} tokens`,
      createdAt: s.startedAt,
      href: s.projectId ? `/dashboard/projects/${s.projectId}` : undefined,
      detail: s.error || undefined,
    })),
    costs: costs.map((c) => ({
      id: c.id,
      collection: "costs" as const,
      title: c.label || c.model,
      meta: `${c.model} · $${c.costUsd.toFixed(4)}${c.tokens ? ` · ${c.tokens} tok` : ""}${c.premium ? " · premium" : ""}`,
      createdAt: c.at,
      detail: c.sessionId ? `session ${c.sessionId}` : undefined,
    })),
    audit: audit.slice(0, 200).map((a) => ({
      id: a.id,
      collection: "audit" as const,
      title: a.action,
      meta: [a.sessionId, a.briefId].filter(Boolean).join(" · ") || "system",
      createdAt: a.at,
      detail: a.detail,
    })),
    "support-threads": support.map((t) => ({
      id: t.id,
      collection: "support-threads" as const,
      title: t.subject || t.id,
      meta: `${t.status} · ${t.messages?.length || 0} msgs`,
      createdAt: t.createdAt,
    })),
  };

  for (const key of MODERATION_COLLECTIONS) {
    if (isModerationReadOnly(key)) continue;
    base[key] = applyFlags(base[key], flags);
  }
  return base;
}

export async function deleteModerationRecord(
  collection: ModerationCollection,
  id: string
): Promise<{
  collection: ModerationCollection;
  id: string;
  title: string;
  cascaded: { collection: ModerationCollection; count: number }[];
} | null> {
  if (isModerationReadOnly(collection)) return null;
  const cascaded: { collection: ModerationCollection; count: number }[] = [];

  if (collection === "projects") {
    const { removed } = await removeFromCollection<Project>("projects", id, SEED_PROJECTS);
    if (!removed) return null;

    const briefs = await readCollection<Brief>("briefs", SEED_BRIEFS);
    const nextBriefs = briefs.filter((b) => b.projectId !== id);
    const briefRemoved = briefs.length - nextBriefs.length;
    if (briefRemoved > 0) {
      await writeCollection("briefs", nextBriefs);
      cascaded.push({ collection: "briefs", count: briefRemoved });
    }

    const sessions = await listSessions();
    const doomed = sessions.filter((s) => s.projectId === id);
    for (const s of doomed) await removeSession(s.id);
    if (doomed.length > 0) {
      cascaded.push({ collection: "agent-sessions", count: doomed.length });
    }

    await clearFlag(collection, id);
    return { collection, id, title: removed.name, cascaded };
  }

  if (collection === "briefs") {
    const { removed } = await removeFromCollection<Brief>("briefs", id, SEED_BRIEFS);
    if (!removed) return null;

    const reviews = await readCollection<{ id: string; briefId: string }>("human-reviews", []);
    const nextReviews = reviews.filter((r) => r.briefId !== id);
    if (nextReviews.length !== reviews.length) {
      await writeCollection("human-reviews", nextReviews);
      cascaded.push({
        collection: "briefs",
        count: reviews.length - nextReviews.length,
      });
    }

    const sessions = await listSessions();
    let cleared = 0;
    for (const s of sessions) {
      if (s.briefId !== id) continue;
      cleared += 1;
      const { briefId: _removed, ...rest } = s;
      await persistSession(rest as typeof s);
    }
    if (cleared > 0) {
      cascaded.push({ collection: "agent-sessions", count: cleared });
    }

    await clearFlag(collection, id);
    return { collection, id, title: removed.title, cascaded };
  }

  if (collection === "monitors") {
    const { removed } = await removeFromCollection<Monitor>("monitors", id, SEED_MONITORS);
    if (!removed) return null;
    await clearFlag(collection, id);
    return { collection, id, title: removed.name, cascaded };
  }

  if (collection === "mailing-list") {
    const { removed } = await removeFromCollection<MailingSubscriber>("mailing-list", id, []);
    if (!removed) return null;
    await clearFlag(collection, id);
    return { collection, id, title: removed.email, cascaded };
  }

  if (collection === "agent-sessions") {
    const removed = await removeSession(id);
    if (!removed) return null;
    await clearFlag(collection, id);
    return {
      collection,
      id,
      title: removed.question.slice(0, 80) || removed.id,
      cascaded,
    };
  }

  const removed = await removeCostLedgerEntry(id);
  if (!removed) return null;
  await clearFlag(collection, id);
  return {
    collection,
    id,
    title: removed.label || removed.model,
    cascaded,
  };
}

export function moderationCounts(
  inventory: Record<ModerationCollection, ModerationRow[]>
) {
  return Object.fromEntries(
    MODERATION_COLLECTIONS.map((key) => [key, inventory[key].length])
  ) as Record<ModerationCollection, number>;
}
