"use client";

import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  File as FileIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import { toast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.md,.txt,.doc,.docx,.csv,.html,.htm";

type QueueStatus = "queued" | "uploading" | "done" | "error";
type QueueItem = { id: string; name: string; size: number; file: File; status: QueueStatus; error?: string };

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function DocumentDropzone({
  projectId,
  disabled = false,
  onUploaded,
}: {
  projectId: string;
  disabled?: boolean;
  onUploaded: (project: Project) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  /** Bounded parallel uploads (3) — faster than strict serial, safer than unbounded. */
  const activeUploads = useRef(0);
  const waitQueue = useRef<Array<() => void>>([]);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const UPLOAD_CONCURRENCY = 3;

  async function withUploadSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (activeUploads.current >= UPLOAD_CONCURRENCY) {
      await new Promise<void>((resolve) => waitQueue.current.push(resolve));
    }
    activeUploads.current += 1;
    try {
      return await fn();
    } finally {
      activeUploads.current -= 1;
      const next = waitQueue.current.shift();
      if (next) next();
    }
  }

  const patch = useCallback((id: string, next: Partial<QueueItem>) => {
    setQueue((q) => q.map((x) => (x.id === id ? { ...x, ...next } : x)));
  }, []);

  const uploadItem = useCallback(
    async (item: QueueItem) => {
      patch(item.id, { status: "uploading" });
      try {
        await withUploadSlot(async () => {
          const form = new FormData();
          form.append("file", item.file, item.file.name);
          const data = await apiFetch<{ project: Project }>(
            `/api/projects/${projectId}/documents`,
            { method: "POST", body: form }
          );
          patch(item.id, { status: "done" });
          invalidateApiCache("/api/projects");
          notifyWorkspaceRefresh(["projects"]);
          onUploaded(data.project);
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : t("ws.docs.uploadFailed");
        patch(item.id, { status: "error", error: message });
        toast.error(`${item.file.name}: ${message}`);
      }
    },
    [projectId, onUploaded, patch, t]
  );

  const enqueue = useCallback(
    (files: FileList | File[]) => {
      const items: QueueItem[] = Array.from(files).map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: f.size,
        file: f,
        status: "queued" as const,
      }));
      if (!items.length) return;
      setQueue((q) => [...q, ...items]);
      // Fire in parallel (slot-limited) instead of a serial promise chain.
      void Promise.all(items.map((item) => uploadItem(item)));
    },
    [uploadItem]
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) enqueue(e.dataTransfer.files);
  }

  const activeCount = queue.filter((q) => q.status === "queued" || q.status === "uploading").length;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) enqueue(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        className={cn("ws-dropzone", dragging && "is-drag", disabled && "is-disabled")}
      >
        <span className="ws-dz-icon">
          <UploadCloud className="h-5 w-5" aria-hidden />
        </span>
        <span className="ws-dz-title">
          <b>{t("ws.docs.clickUpload")}</b> {t("ws.docs.orDrag")}
        </span>
        <span className="ws-dz-hint">
          PDF, DOCX, TXT, MD, CSV, HTML{activeCount > 0 ? ` · ${activeCount} in queue` : ""}
        </span>
      </button>

      {queue.length > 0 && (
        <details className="ws-dz-scroll" open={queue.length <= 5 ? true : undefined}>
          <summary className="ws-dz-scroll-summary">
            Upload queue · {queue.length}
            {activeCount > 0 ? ` · ${activeCount} active` : ""}
          </summary>
          <div className="ws-dz-queue">
            {queue.map((item) => (
              <div key={item.id} className="ws-dz-item">
                <span
                  className={cn(
                    item.status === "done" && "ws-dz-status-done",
                    item.status === "error" && "ws-dz-status-error",
                    item.status === "uploading" && "ws-dz-status-uploading"
                  )}
                >
                  {item.status === "uploading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : item.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  ) : item.status === "error" ? (
                    <AlertCircle className="h-4 w-4" aria-hidden />
                  ) : (
                    <FileIcon className="h-4 w-4 text-faint" aria-hidden />
                  )}
                </span>
                <span className="ws-dz-name" title={item.error || item.name}>
                  {item.name}
                </span>
                <span className="ws-dz-size">
                  {item.status === "error" ? "Failed" : formatSize(item.size)}
                </span>
                {(item.status === "done" || item.status === "error") && (
                  <button
                    type="button"
                    className="ws-dz-remove"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => setQueue((q) => q.filter((x) => x.id !== item.id))}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="ws-dz-retention">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Uploaded documents are retained for 30 days, then automatically purged per our data-retention
        policy.
      </p>
    </div>
  );
}
