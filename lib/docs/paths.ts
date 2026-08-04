import path from "path";

/** Opaque on-disk root — never return this path to clients. */
export const UPLOADS_ROOT = path.join(process.cwd(), "data", "local", "uploads");

export function projectUploadDir(projectId: string) {
  return path.join(UPLOADS_ROOT, safeSegment(projectId));
}

export function documentBlobPath(projectId: string, docId: string) {
  return path.join(projectUploadDir(projectId), safeSegment(docId));
}

/** Reject path traversal / absolute segments. */
export function safeSegment(id: string) {
  const s = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!s || s.includes("..")) throw new Error("Invalid storage id");
  return s;
}

export const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".md",
  ".txt",
  ".doc",
  ".docx",
  ".csv",
  ".html",
  ".htm",
]);

export function assertAllowedFilename(name: string) {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type not allowed (${ext || "unknown"})`);
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw new Error("Invalid file name");
  }
  return ext;
}
