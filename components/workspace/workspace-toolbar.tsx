"use client";

import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type WorkspaceFilter = {
  id: string;
  label: string;
  count?: number;
  /** Optional spotlight / tour selector attribute. */
  tourId?: string;
  /** Hover hint shown via tooltip. */
  title?: string;
};

export type WorkspaceSortOption = {
  value: string;
  label: string;
};

export function WorkspaceToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  activeFilter,
  onFilterChange,
  sort,
  sortOptions,
  onSortChange,
  showSearch = true,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: WorkspaceFilter[];
  activeFilter?: string;
  onFilterChange?: (id: string) => void;
  sort?: string;
  sortOptions?: WorkspaceSortOption[];
  onSortChange?: (value: string) => void;
  showSearch?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("ws-toolbar", className)}>
      {showSearch && (
        <label className="ws-search">
          <Search className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </label>
      )}
      {sortOptions && sortOptions.length > 0 && onSortChange && (
        <label className="ws-sort">
          <span className="sr-only">Sort by</span>
          <Select compact value={sort} onChange={(e) => onSortChange(e.target.value)} aria-label="Sort by">
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </label>
      )}
      {filters && filters.length > 0 && onFilterChange && (
        <div className="ws-filter-row" role="tablist" aria-label="Filter">
          {filters.map((f) => {
            const chip = (
              <button
                type="button"
                role="tab"
                aria-selected={activeFilter === f.id}
                title={f.title || f.label}
                className={cn("ws-filter-chip", activeFilter === f.id && "is-active")}
                data-tour={f.tourId || undefined}
                onClick={() => onFilterChange(f.id)}
              >
                {f.label}
                {f.count !== undefined && <span className="ws-filter-count">{f.count}</span>}
              </button>
            );
            if (!f.title) return <span key={f.id}>{chip}</span>;
            return (
              <Tooltip key={f.id} content={f.title} side="bottom" wrap={false}>
                {chip}
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
