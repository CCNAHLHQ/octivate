"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Eye,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { bbcodeToSafeHtml } from "@/lib/auth/bbcode";
import { cn } from "@/lib/utils";

type Tool = {
  id: string;
  label: string;
  icon: typeof Bold;
  wrap?: [string, string];
  insert?: string;
  prompt?: "url" | "img";
};

const TOOLS: Tool[] = [
  { id: "b", label: "Bold", icon: Bold, wrap: ["[b]", "[/b]"] },
  { id: "i", label: "Italic", icon: Italic, wrap: ["[i]", "[/i]"] },
  { id: "u", label: "Underline", icon: Underline, wrap: ["[u]", "[/u]"] },
  { id: "s", label: "Strike", icon: Strikethrough, wrap: ["[s]", "[/s]"] },
  { id: "url", label: "Link", icon: Link2, prompt: "url" },
  { id: "img", label: "Image", icon: ImageIcon, prompt: "img" },
  { id: "quote", label: "Quote", icon: Quote, wrap: ["[quote]", "[/quote]"] },
  { id: "code", label: "Code", icon: Code2, wrap: ["[code]", "[/code]"] },
  { id: "list", label: "List", icon: List, insert: "[list]\n[*]Item\n[/list]" },
];

function applyWrap(
  value: string,
  start: number,
  end: number,
  open: string,
  close: string
) {
  const selected = value.slice(start, end) || "text";
  const next = value.slice(0, start) + open + selected + close + value.slice(end);
  return {
    next,
    cursorStart: start + open.length,
    cursorEnd: start + open.length + selected.length,
  };
}

export function BbcodeEditor({
  value,
  onChange,
  maxChars,
  placeholder,
  label = "Description",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  maxChars: number;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");

  const previewHtml = useMemo(() => bbcodeToSafeHtml(value), [value]);
  const remaining = maxChars - value.length;

  function runTool(tool: Tool) {
    const el = areaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;

    let next = value;
    let cursorStart = start;
    let cursorEnd = end;

    if (tool.prompt === "url") {
      const href = window.prompt("Link URL (https://…)");
      if (!href) return;
      if (!/^https?:\/\//i.test(href.trim())) {
        window.alert("Only http(s) links are allowed");
        return;
      }
      const selected = value.slice(start, end) || "link text";
      const open = `[url=${href.trim()}]`;
      const close = "[/url]";
      next = value.slice(0, start) + open + selected + close + value.slice(end);
      cursorStart = start + open.length;
      cursorEnd = cursorStart + selected.length;
    } else if (tool.prompt === "img") {
      const src = window.prompt("Image URL (https://…)");
      if (!src) return;
      if (!/^https?:\/\//i.test(src.trim())) {
        window.alert("Only http(s) image URLs are allowed");
        return;
      }
      const tag = `[img]${src.trim()}[/img]`;
      next = value.slice(0, start) + tag + value.slice(end);
      cursorStart = start + tag.length;
      cursorEnd = cursorStart;
    } else if (tool.insert) {
      next = value.slice(0, start) + tool.insert + value.slice(end);
      cursorStart = start + tool.insert.length;
      cursorEnd = cursorStart;
    } else if (tool.wrap) {
      const result = applyWrap(value, start, end, tool.wrap[0], tool.wrap[1]);
      next = result.next;
      cursorStart = result.cursorStart;
      cursorEnd = result.cursorEnd;
    }

    onChange(next.slice(0, maxChars));
    requestAnimationFrame(() => {
      const node = areaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  return (
    <div className={cn("bb-editor", className)}>
      <div className="bb-editor-head">
        <span className="bb-editor-label">{label}</span>
        <div className="bb-editor-modes" role="tablist" aria-label="Editor mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "write"}
            className={cn("bb-editor-mode", mode === "write" && "is-active")}
            onClick={() => setMode("write")}
          >
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            className={cn("bb-editor-mode", mode === "preview" && "is-active")}
            onClick={() => setMode("preview")}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>
      </div>

      {mode === "write" ? (
        <>
          <div className="bb-editor-toolbar" role="toolbar" aria-label="BBCode tools">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  className="bb-editor-tool"
                  title={tool.label}
                  aria-label={tool.label}
                  onClick={() => runTool(tool)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
          <textarea
            ref={areaRef}
            className="bb-editor-area"
            value={value}
            maxLength={maxChars}
            placeholder={
              placeholder ||
              "Short bio with optional BBCode — [b]bold[/b], [url=https://…]link[/url]"
            }
            onChange={(e) => onChange(e.target.value.slice(0, maxChars))}
          />
        </>
      ) : (
        <div
          className="bb-editor-preview"
          dangerouslySetInnerHTML={{
            __html: previewHtml || "<span class='bb-empty'>Nothing to preview yet.</span>",
          }}
        />
      )}

      <div className="bb-editor-foot">
        <span>MyBB-style BBCode · links/images must be https</span>
        <span className={cn(remaining < 40 && "text-amber")}>
          {value.length}/{maxChars}
        </span>
      </div>
    </div>
  );
}
