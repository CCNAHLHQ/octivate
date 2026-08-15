"use client";

import { useMemo, useState } from "react";
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
  const [verboseId, setVerboseId] = useState<string | null>(null);

  const lines = useMemo(
    () => (showDebug ? events : events.filter((e) => e.level !== "debug")),
    [events, showDebug]
  );

  return (
    <div className="op-auto2-secondary-block">
      <div className="op-auto2-secondary-head">
        <h4>Console</h4>
        <button type="button" className="op-auto2-link" onClick={onToggleDebug}>
          {showDebug ? "Hide debug" : "Show debug"}
        </button>
      </div>
      <ul className="op-auto2-console">
        {lines.slice(0, 50).map((e) => {
          const open = verboseId === e.id;
          const hasMeta = e.meta != null;
          return (
            <li key={e.id} data-level={e.level}>
              <button
                type="button"
                className="op-auto2-console-line"
                onClick={() => setVerboseId(open ? null : e.id)}
                disabled={!hasMeta && !e.message}
              >
                <time>{new Date(e.at).toLocaleTimeString()}</time>
                <span>{e.message}</span>
                {hasMeta ? <em>{open ? "−" : "+"}</em> : null}
              </button>
              {open ? (
                <pre className="op-auto2-console-json">
                  {JSON.stringify(
                    {
                      id: e.id,
                      at: e.at,
                      level: e.level,
                      message: e.message,
                      pid: e.pid ?? null,
                      meta: e.meta ?? null,
                    },
                    null,
                    2
                  )}
                </pre>
              ) : null}
            </li>
          );
        })}
        {!lines.length ? <li className="op-auto2-empty">No events</li> : null}
      </ul>
    </div>
  );
}
