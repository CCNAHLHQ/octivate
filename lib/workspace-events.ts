export type WorkspaceScope =
  | "projects"
  | "monitors"
  | "briefs"
  | "marquee"
  | "overview"
  | "all";

export const WORKSPACE_REFRESH_EVENT = "octivate:workspace-refresh";

export function notifyWorkspaceRefresh(
  scope: WorkspaceScope | WorkspaceScope[] = "all"
) {
  if (typeof window === "undefined") return;
  const scopes = Array.isArray(scope) ? scope : [scope];
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_REFRESH_EVENT, { detail: { scopes } })
  );
}

export function matchesWorkspaceScope(
  eventScopes: WorkspaceScope[] | undefined,
  listen: WorkspaceScope[]
): boolean {
  if (!eventScopes?.length) return true;
  if (eventScopes.includes("all") || listen.includes("all")) return true;
  return eventScopes.some((s) => listen.includes(s));
}
