"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Props = {
  count?: number;
  onCleared?: () => void | Promise<void>;
  className?: string;
  size?: "sm" | "default";
};

export function DeleteAllSourcesButton({
  count = 0,
  onCleared,
  className,
  size = "sm",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function runDelete() {
    if (busy) return;
    setBusy(true);
    try {
      const data = await apiFetch<{ ok: boolean; deleted: number }>("/api/sources", {
        method: "DELETE",
        skipCache: true,
      });
      invalidateApiCache("/api/sources");
      toast.success(
        data.deleted > 0
          ? `Deleted ${data.deleted} source${data.deleted === 1 ? "" : "s"}`
          : "Source registry already empty"
      );
      setOpen(false);
      await onCleared?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete sources");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant="ghost"
        className={cn("text-amber", className)}
        disabled={busy || count === 0}
        onClick={() => setOpen(true)}
        title={count === 0 ? "No sources to delete" : "Delete all sources"}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        )}
        Delete all
      </Button>

      <ConfirmDialog
        open={open}
        busy={busy}
        busyLabel="Deleting…"
        title="Delete all sources?"
        description={
          count > 0
            ? `This removes ${count} source${count === 1 ? "" : "s"} from the live registry. This cannot be undone.`
            : "Delete all sources from the live registry?\n\nThis cannot be undone."
        }
        confirmLabel="Delete all"
        onCancel={() => {
          if (!busy) setOpen(false);
        }}
        onConfirm={() => void runDelete()}
      />
    </>
  );
}
