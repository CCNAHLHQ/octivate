/** Cross-module refresh when probe/capture mutates registry health. */
export const SOURCES_CHANGED_EVENT = "octivate:sources-changed";

export function notifySourcesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SOURCES_CHANGED_EVENT));
}
