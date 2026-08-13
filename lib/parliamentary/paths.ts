import path from "path";
import type { CountryCode } from "@/lib/parliamentary/types";
import { slugifyTitle } from "@/lib/parliamentary/detect";

export function mediaRoot(): string {
  const env = process.env.PARL_MEDIA_ROOT?.trim();
  const cwd = /* turbopackIgnore: true */ process.cwd();
  if (env) {
    return path.isAbsolute(env) ? env : path.join(cwd, env);
  }
  return path.join(cwd, "data", "local", "parliamentary-videos");
}

export function mediaIndexDir(): string {
  const cwd = /* turbopackIgnore: true */ process.cwd();
  return path.join(cwd, "data", "local", "parliamentary-media");
}

export function buildArtifactFolder(
  country: CountryCode,
  title: string,
  at = new Date()
): string {
  const yyyy = String(at.getUTCFullYear());
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  const slug = slugifyTitle(title);
  return path.join(mediaRoot(), country, yyyy, `${slug}_${stamp}`);
}

export function relativeToCwd(abs: string): string {
  return path.relative(process.cwd(), abs).replace(/\\/g, "/");
}
