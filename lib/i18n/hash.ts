import { createHash } from "crypto";

export function hashSource(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}
