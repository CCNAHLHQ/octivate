"use client";

import { Plus } from "lucide-react";
import type { AutoSeed } from "./types";

export function AutomationSources({
  seeds,
  url,
  country,
  busy,
  onUrl,
  onCountry,
  onAdd,
  onReset,
}: {
  seeds: AutoSeed[];
  url: string;
  country: string;
  busy: boolean;
  onUrl: (v: string) => void;
  onCountry: (v: string) => void;
  onAdd: () => void;
  onReset: () => void;
}) {
  return (
    <div className="op-auto2-secondary-block">
      <div className="op-auto2-secondary-head">
        <h4>Sources</h4>
        <button type="button" className="op-auto2-link" onClick={onReset} disabled={busy}>
          Reset verified
        </button>
      </div>
      <div className="op-auto2-seed-form">
        <input
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="https://vimeo.com/…"
          disabled={busy}
        />
        <select value={country} onChange={(e) => onCountry(e.target.value)} disabled={busy}>
          <option value="BB">BB</option>
          <option value="GY">GY</option>
          <option value="TT">TT</option>
          <option value="JM">JM</option>
        </select>
        <button type="button" className="op-auto2-btn is-primary" onClick={onAdd} disabled={busy || !url.trim()}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
      <ul className="op-auto2-seed-list">
        {seeds.map((s) => (
          <li key={s.id}>
            <span>{s.label}</span>
            <code>{s.country}</code>
          </li>
        ))}
        {!seeds.length ? <li className="op-auto2-empty">No sources</li> : null}
      </ul>
    </div>
  );
}
