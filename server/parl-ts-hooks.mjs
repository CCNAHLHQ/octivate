/**
 * Resolve `@/` imports to TypeScript sources for the parl-media worker
 * (used with `node --experimental-strip-types --import ./server/parl-ts-register.mjs`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveAt(specifier) {
  const rel = specifier.slice(2);
  const candidates = [
    path.join(root, `${rel}.ts`),
    path.join(root, `${rel}.tsx`),
    path.join(root, rel, "index.ts"),
    path.join(root, `${rel}.js`),
    path.join(root, rel),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return pathToFileURL(c).href;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const href = resolveAt(specifier);
    if (href) {
      return { shortCircuit: true, url: href };
    }
  }
  return nextResolve(specifier, context);
}
