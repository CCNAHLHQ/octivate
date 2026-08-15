"use client";

import type { AutoEvent } from "./types";

export function AutomationConsole({
  events,
  showDebug,
  onToggleDebug,
}: {
  events: AutoEvent[];
  showDebug: boolean;
  onToggleDebug: () => void;
}) {
  const lines = showDebug
    ? events
    : events.filter((e) => e.level !== "debug");

  return (
    <div className="op-auto2-secondary-block">
      <div className="op-auto2-secondary-head">
        <h4>Console</h4>
        <button type="button" className="op-auto2-link" onClick={onToggleDebug}>
          {showDebug ? "Hide debug" : "Show debug"}
        </button>
      </div>
      <ul className="op-auto2-console">
        {lines.slice(0, 40).map((e) => (
          <li key={e.id} data-level={e.level}>
            <time>{new Date(e.at).toLocaleTimeString()}</time>
            <span>{e.message}</span>
          </li>
        ))}
        {!lines.length ? <li className="op-auto2-empty">No events</li> : null}
      </ul>
    </div>
  );
}
