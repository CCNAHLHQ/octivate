"use client";

import { useEffect } from "react";
import {
  WORKSPACE_REFRESH_EVENT,
  matchesWorkspaceScope,
  type WorkspaceScope,
} from "@/lib/workspace-events";

export function useWorkspaceRefresh(
  onRefresh: () => void | Promise<void>,
  scopes: WorkspaceScope[] = ["all"]
) {
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ scopes?: WorkspaceScope[] }>).detail;
      if (!matchesWorkspaceScope(detail?.scopes, scopes)) return;
      void onRefresh();
    };
    window.addEventListener(WORKSPACE_REFRESH_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, handler);
  }, [onRefresh, scopes]);
}
