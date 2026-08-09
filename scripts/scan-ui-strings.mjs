import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "components/dashboard/overview.tsx",
  "app/dashboard/projects/page.tsx",
  "app/dashboard/projects/[id]/page.tsx",
  "app/dashboard/account/page.tsx",
  "app/dashboard/monitors/page.tsx",
  "app/dashboard/monitors/[id]/page.tsx",
  "app/dashboard/briefs/page.tsx",
  "app/dashboard/briefs/[id]/page.tsx",
  "app/dashboard/sources/page.tsx",
  "app/dashboard/usage/page.tsx",
  "app/dashboard/packs/page.tsx",
  "app/dashboard/stakeholders/page.tsx",
  "components/workspace/workspace-toolbar.tsx",
  "components/support/support-widget.tsx",
  "components/support/support-page.tsx",
  "lib/onboarding/content.ts",
  "lib/onboarding/operator-content.ts",
  "components/onboarding/workspace-intro-modal.tsx",
  "components/onboarding/operator-intro-modal.tsx",
  "components/dashboard/topic-starters.tsx",
  "components/dashboard/document-dropzone.tsx",
  "components/dashboard/document-library.tsx",
  "components/dashboard/document-summary-modal.tsx",
  "components/dashboard/question-voice-field.tsx",
  "components/dashboard/project-insights.tsx",
  "components/dashboard/agent-pipeline.tsx",
  "components/operator/operator-boards.tsx",
  "components/dashboard/operator-console.tsx",
  "components/operator/operator-limits-panel.tsx",
  "components/operator/operator-model-config-panel.tsx",
  "components/operator/operator-operations-panel.tsx",
  "components/operator/operator-sources-panel.tsx",
  "components/operator/operator-mail-panel.tsx",
  "components/operator/operator-support-inbox.tsx",
  "components/operator/autosave-status.tsx",
  "app/dashboard/loading.tsx",
  "app/dashboard/page.tsx",
];

const out = [];
for (const f of files) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) {
    out.push(`\n## MISSING ${f}`);
    continue;
  }
  const s = fs.readFileSync(p, "utf8");
  out.push(`\n## ${f}`);
  const seen = new Set();
  const add = (kind, t) => {
    const v = t.replace(/\s+/g, " ").trim();
    if (!v || seen.has(v)) return;
    if (v.length < 2 || v.length > 160) return;
    if (/^[a-z0-9_./:-]+$/i.test(v) && !v.includes(" ")) return;
    if (v.startsWith("http") || v.includes("@/") || v.includes("${")) return;
    if (/^(use |import |export |const |function |className|href|src)/.test(v)) return;
    seen.add(v);
    out.push(`${kind}: ${v}`);
  };

  for (const m of s.matchAll(/>([A-Za-z][^<>{\n]{1,120})</g)) add("TXT", m[1]);
  for (const m of s.matchAll(
    /(?:title|subtitle|label|placeholder|description|aria-label|alt|name)\s*=\s*["']([^"']{2,140})["']/g
  )) {
    add("ATTR", m[1]);
  }
  for (const m of s.matchAll(/["']([A-Z][^"']{3,120})["']/g)) {
    const t = m[1];
    if (/[{}]/.test(t)) continue;
    if (/^(GET|POST|PUT|DELETE|PATCH|Content-Type)/.test(t)) continue;
    add("STR", t);
  }
}

fs.writeFileSync(path.join(root, "tmp-ui-strings.txt"), out.join("\n"), "utf8");
console.log(`Wrote tmp-ui-strings.txt (${out.length} lines)`);
