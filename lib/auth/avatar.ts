import { promises as fs } from "fs";
import path from "path";

const AVATAR_DIR = path.join(process.cwd(), "data", "local", "avatars");
/** Fallback only — prefer operator-configured maxAvatarSizeKb (2 MB default). */
export const DEFAULT_MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const ALLOWED_AVATAR_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
] as const);

type AvatarMime = "image/jpeg" | "image/png" | "image/webp";

const EXT_BY_MIME: Record<AvatarMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MIME_BY_EXT: Record<string, AvatarMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function detectAvatarMime(buf: Buffer): AvatarMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function avatarPath(userId: string, ext: string) {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/[^a-z0-9]/g, "");
  return path.join(AVATAR_DIR, `${safeId}.${safeExt}`);
}

async function ensureDir() {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
}

export async function readAvatarFile(
  userId: string,
  ext: string
): Promise<{ buffer: Buffer; mime: AvatarMime } | null> {
  const mime = MIME_BY_EXT[ext];
  if (!mime) return null;
  try {
    const buffer = await fs.readFile(avatarPath(userId, ext));
    const detected = detectAvatarMime(buffer);
    if (detected !== mime) return null;
    return { buffer, mime };
  } catch {
    return null;
  }
}

export async function writeAvatarFile(
  userId: string,
  buffer: Buffer,
  maxBytes: number = DEFAULT_MAX_AVATAR_BYTES
): Promise<{ ext: string; mime: AvatarMime }> {
  const cap = Math.max(64 * 1024, Math.min(maxBytes, 10 * 1024 * 1024));
  if (buffer.length === 0 || buffer.length > cap) {
    const mb = Math.round((cap / (1024 * 1024)) * 10) / 10;
    throw new Error(`Avatar must be under ${mb} MB`);
  }
  const mime = detectAvatarMime(buffer);
  if (!mime || !ALLOWED_AVATAR_MIME.has(mime)) {
    throw new Error("Avatar must be a JPEG, PNG, or WebP image");
  }
  const ext = EXT_BY_MIME[mime];
  await ensureDir();
  await deleteAvatarFiles(userId);
  await fs.writeFile(avatarPath(userId, ext), buffer);
  return { ext, mime };
}

export async function deleteAvatarFiles(userId: string): Promise<void> {
  await ensureDir();
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const entries = await fs.readdir(AVATAR_DIR).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((name) => name.startsWith(`${safeId}.`))
      .map((name) => fs.unlink(path.join(AVATAR_DIR, name)).catch(() => undefined))
  );
}

export function parseDataUrlImage(dataUrl: string): Buffer {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    dataUrl.trim()
  );
  if (!match) throw new Error("Invalid image data URL");
  const buf = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!buf.length) throw new Error("Empty image payload");
  return buf;
}

/** @deprecated Use DEFAULT_MAX_AVATAR_BYTES or operator limits. */
export const MAX_AVATAR_BYTES = DEFAULT_MAX_AVATAR_BYTES;
