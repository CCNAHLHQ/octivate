/** Shared muted-loop autoplay helpers for hero / shell video plates. */

export function bindAutoplayBackdrop(
  video: HTMLVideoElement,
  onReady: () => void
): () => void {
  let cancelled = false;

  const markReady = () => {
    if (!cancelled) onReady();
  };

  const tryPlay = () => {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  };

  video.addEventListener("loadeddata", markReady);
  video.addEventListener("playing", markReady);
  video.addEventListener("canplay", tryPlay);

  if (video.readyState >= 2) {
    markReady();
    tryPlay();
  } else {
    tryPlay();
  }

  const onVis = () => {
    if (document.visibilityState === "visible") tryPlay();
  };
  const watchdog = window.setInterval(() => {
    if (cancelled || document.visibilityState !== "visible") return;
    if (video.readyState >= 2) markReady();
    if (video.paused || video.ended) tryPlay();
  }, 2500);

  document.addEventListener("visibilitychange", onVis);

  return () => {
    cancelled = true;
    window.clearInterval(watchdog);
    document.removeEventListener("visibilitychange", onVis);
    video.removeEventListener("loadeddata", markReady);
    video.removeEventListener("playing", markReady);
    video.removeEventListener("canplay", tryPlay);
    video.pause();
  };
}
