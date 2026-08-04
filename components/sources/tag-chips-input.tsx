"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
};

export function TagChipsInput({ label, value, onChange, placeholder, hint }: Props) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next.slice(0, 40));
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <label className="src-edit-field">
      <span className="src-edit-label">{label}</span>
      <div className="src-tag-input">
        {value.map((tag) => (
          <span key={tag} className="src-tag-chip">
            {tag}
            <button
              type="button"
              className="src-tag-chip-x"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className={cn("src-tag-draft", !value.length && "is-empty")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          placeholder={value.length ? placeholder || "Add…" : placeholder || "Type, then Enter"}
        />
      </div>
      {hint ? <span className="src-edit-hint">{hint}</span> : null}
    </label>
  );
}
