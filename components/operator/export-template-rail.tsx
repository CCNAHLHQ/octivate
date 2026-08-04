"use client";

import { useState } from "react";
import { Copy, GripVertical, Pencil, Trash2 } from "lucide-react";
import type { ExportFormat, ExportTemplate } from "@/lib/types";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function formatLabel(f: ExportFormat) {
  return f.toUpperCase();
}

function templateTooltip(t: ExportTemplate) {
  const formats = t.supportsFormats.map(formatLabel).join(", ");
  const updated = new Date(t.updatedAt).toLocaleDateString();
  return `${formats} · Updated ${updated}`;
}

export function ExportTemplateRail({
  templates,
  selectedId,
  busyId,
  labelOverrides,
  dirtyId,
  onSelect,
  onDragStart,
  onDragEnd,
  onDropReorder,
  onDelete,
  onDuplicate,
  onRename,
}: {
  templates: ExportTemplate[];
  selectedId: string | null;
  busyId: string | null;
  labelOverrides?: Record<string, string>;
  dirtyId?: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropReorder: (targetId: string) => void;
  onDelete: (template: ExportTemplate) => void;
  onDuplicate: (template: ExportTemplate) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (templates.length === 0) {
    return <p className="exp-rail-empty">No templates match.</p>;
  }

  function commitRename(id: string) {
    const value = editValue.trim();
    if (value) onRename(id, value);
    setEditingId(null);
  }

  return (
    <div className="exp-rail-list">
      {templates.map((template) => {
        const displayName = labelOverrides?.[template.id]?.trim() || template.name;
        const isDirty = dirtyId === template.id;
        const isEditing = editingId === template.id;
        const isDropTarget = overId === template.id && draggingId !== null && draggingId !== template.id;

        return (
          <div
            key={template.id}
            role="button"
            tabIndex={0}
            title={templateTooltip(template)}
            className={cn(
              "exp-rail-card",
              selectedId === template.id && "is-selected",
              !template.enabled && "is-disabled",
              isDirty && "is-dirty",
              isDropTarget && "is-drop-target",
              draggingId === template.id && "is-dragging"
            )}
            draggable={!isEditing}
            onDragStart={() => {
              setDraggingId(template.id);
              onDragStart(template.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setOverId(null);
              onDragEnd();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(template.id);
            }}
            onDragLeave={() => setOverId((cur) => (cur === template.id ? null : cur))}
            onDrop={() => {
              setOverId(null);
              onDropReorder(template.id);
            }}
            onClick={() => !isEditing && onSelect(template.id)}
            onKeyDown={(e) => {
              if (isEditing) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(template.id);
              }
            }}
          >
            <div className="exp-rail-grip" aria-hidden>
              <GripVertical className="h-3.5 w-3.5" />
            </div>

            {isEditing ? (
              <input
                className="exp-rail-rename"
                value={editValue}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitRename(template.id)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") commitRename(template.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                aria-label="Rename template"
              />
            ) : (
              <p className="exp-rail-name">{displayName}</p>
            )}

            <div className="exp-rail-meta">
              <div className="exp-rail-tags">
                {template.imported && <span className="exp-rail-tag is-import">Import</span>}
                {isDirty && <span className="exp-rail-tag is-draft">Draft</span>}
                {template.enabled && <span className="exp-rail-tag is-live">Live</span>}
              </div>
              <div className="exp-rail-actions" onClick={(e) => e.stopPropagation()}>
                <Tooltip content="Rename" side="top">
                  <button
                    type="button"
                    className="exp-rail-action"
                    aria-label="Rename template"
                    onClick={() => {
                      setEditingId(template.id);
                      setEditValue(displayName);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </Tooltip>
                <Tooltip content="Duplicate" side="top">
                  <button
                    type="button"
                    className="exp-rail-action"
                    aria-label="Duplicate template"
                    disabled={busyId === template.id}
                    onClick={() => onDuplicate(template)}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </Tooltip>
                <Tooltip content="Delete template" side="top">
                  <button
                    type="button"
                    className="exp-rail-action is-danger"
                    aria-label="Delete template"
                    disabled={busyId === template.id}
                    onClick={() => onDelete(template)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
