import type { SupportAttachment } from "@/lib/support/types";

export const SUPPORT_ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
export const SUPPORT_MAX_IMAGE_BYTES = 1_500_000;
export const SUPPORT_MAX_ATTACHMENTS = 3;

const MAGIC: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x39],
    [0x47, 0x49, 0x46, 0x38, 0x37],
  ],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};

function matchesMagic(bytes: Uint8Array, mime: string) {
  const patterns = MAGIC[mime];
  if (!patterns) return false;
  return patterns.some((pattern) => pattern.every((b, i) => bytes[i] === b));
}

export async function readSupportImageAttachment(file: File): Promise<SupportAttachment> {
  if (!SUPPORT_ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Only PNG, JPEG, WebP, or GIF images are allowed");
  }
  if (file.size <= 0 || file.size > SUPPORT_MAX_IMAGE_BYTES) {
    throw new Error("Each image must be under 1.5 MB");
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!matchesMagic(bytes, file.type)) {
    throw new Error("File contents do not match the declared image type");
  }
  if (file.type === "image/webp") {
    const riff = String.fromCharCode(...bytes.slice(8, 12));
    if (riff !== "WEBP") throw new Error("Invalid WebP image");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });

  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name.slice(0, 80) || "image",
    mime: file.type as SupportAttachment["mime"],
    size: file.size,
    dataUrl,
  };
}
