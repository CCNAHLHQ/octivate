export const PIPELINE_MODE_EVENT = "octivate:pipeline-mode";

export function notifyPipelineModeChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PIPELINE_MODE_EVENT));
  }
}
