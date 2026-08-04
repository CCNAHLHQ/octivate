"use client";

import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { apiFetch, getClientApiKey, invalidateApiCache } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type CsvImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  upserted: number;
  total: number;
  rows: number;
  path?: string;
  files?: string[];
  fileReports?: { name: string; rows: number; created: number; updated: number; error?: string }[];
};

type Props = {
  onImported?: (result: CsvImportResult) => void | Promise<void>;
  className?: string;
  compact?: boolean;
};

const IMPORT_PATH = "/api/sources/import";

function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv")) return false;
  const t = (file.type || "").toLowerCase();
  return (
    !t ||
    t === "text/csv" ||
    t === "application/csv" ||
    t === "application/vnd.ms-excel" ||
    t === "text/plain" ||
    t === "application/octet-stream"
  );
}

export function CsvSourceDropzone({ onImported, className, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = useCallback(
    async (list: File[]) => {
      const files = list.filter(isCsvFile);
      if (!files.length) {
        toast.error("Only CSV documents are accepted");
        return;
      }
      if (files.length < list.length) {
        toast.info("Skipped non-CSV files — importing CSV only");
      }

      setBusy(true);
      try {
        const body = new FormData();
        for (const file of files) {
          body.append("files", file, file.name);
        }
        body.append("replaceAll", "false");

        const data = await apiFetch<CsvImportResult>(IMPORT_PATH, {
          method: "POST",
          body,
          headers: {
            Authorization: `Bearer ${getClientApiKey()}`,
          },
          skipCache: true,
        });

        invalidateApiCache("/api/sources");

        const fileCount = data.files?.length || files.length;
        const failed = (data.fileReports || []).filter((f) => f.error);
        toast.success(
          fileCount > 1
            ? `Imported ${fileCount} CSVs · ${data.rows} rows · ${data.created} new · ${data.updated} updated · ${data.total} total`
            : `Imported ${data.rows} rows · ${data.created} new · ${data.updated} updated · ${data.total} total`
        );
        if (failed.length) {
          toast.warning(
            `${failed.length} file(s) had issues: ${failed.map((f) => f.name).join(", ")}`
          );
        }
        await onImported?.(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "CSV import failed");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onImported]
  );

  const onFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      void upload(Array.from(fileList));
    },
    [upload]
  );

  return (
    <div
      className={cn(
        "src-csv-drop",
        compact && "is-compact",
        dragging && "is-dragging",
        busy && "is-busy",
        className
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        onFiles(e.dataTransfer.files);
      }}
      role="region"
      aria-label="CSV source registry upload"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="sr-only"
        disabled={busy}
        onChange={(e) => onFiles(e.target.files)}
      />
      <div className="src-csv-drop-icon" aria-hidden>
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-5 w-5" />
        )}
      </div>
      <div className="src-csv-drop-copy">
        <p className="src-csv-drop-title">
          {busy ? "Importing CSV…" : "Drop CSV files to update the registry"}
        </p>
        <p className="src-csv-drop-hint">
          Multiple CSV supported · merges into live sources · requires signed-in API access
        </p>
      </div>
      <button
        type="button"
        className="src-csv-drop-btn"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" aria-hidden />
        Choose CSVs
      </button>
    </div>
  );
}
