import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { mediaIndexDir } from "@/lib/parliamentary/paths";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function thumbsDir() {
  return path.join(mediaIndexDir(), "thumbs");
}

function cachePath(vimeoId: string) {
  const safe = vimeoId.replace(/\D/g, "");
  return path.join(thumbsDir(), `${safe}.jpg`);
}

async function resolveVimeoThumbUrl(vimeoId: string): Promise<string | null> {
  const id = vimeoId.replace(/\D/g, "");
  if (!id) return null;

  try {
    const res = await fetch(`https://vimeo.com/api/v2/video/${id}.json`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const rows = (await res.json()) as Array<{
        thumbnail_large?: string;
        thumbnail_medium?: string;
        thumbnail_small?: string;
      }>;
      const row = rows?.[0];
      const url =
        row?.thumbnail_large || row?.thumbnail_medium || row?.thumbnail_small;
      if (url) return url.replace(/_\d+x\d+/, "_640x360");
    }
  } catch {
    /* fall through */
  }

  try {
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}`,
      {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (res.ok) {
      const data = (await res.json()) as { thumbnail_url?: string };
      if (data.thumbnail_url) return data.thumbnail_url;
    }
  } catch {
    /* fall through */
  }

  return `https://vumbnail.com/${id}.jpg`;
}

/** Load or fetch+cache a Vimeo poster. Returns JPEG bytes. */
export async function loadVimeoThumbnail(
  vimeoId: string
): Promise<{ bytes: Buffer; etag: string } | null> {
  const id = vimeoId.replace(/\D/g, "");
  if (!id) return null;

  const file = cachePath(id);
  try {
    const bytes = await fs.readFile(file);
    if (bytes.length > 200) {
      return {
        bytes,
        etag: `"${createHash("sha1").update(bytes).digest("hex").slice(0, 16)}"`,
      };
    }
  } catch {
    /* miss */
  }

  const remote = await resolveVimeoThumbUrl(id);
  if (!remote) return null;

  const res = await fetch(remote, {
    headers: { "User-Agent": UA, Referer: `https://vimeo.com/${id}` },
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
  });
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 200) return null;

  await fs.mkdir(thumbsDir(), { recursive: true });
  await fs.writeFile(file, bytes);

  return {
    bytes,
    etag: `"${createHash("sha1").update(bytes).digest("hex").slice(0, 16)}"`,
  };
}

export function previewPathForVimeo(vimeoId: string) {
  const id = vimeoId.replace(/\D/g, "");
  return id
    ? `/api/operator/parliamentary-media/thumb?id=${encodeURIComponent(id)}`
    : null;
}
