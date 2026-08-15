"use client";

import { useEffect, useRef, useState } from "react";
import { HERO_VIDEO_SRC } from "@/components/landing/hero-video-backdrop";

/**
 * Fitted muted autoplay loop for dashboard / operator shells
 * (same plate as landing + agent pipeline). Excluded from project interiors.
 */
export function WorkspaceVideoBackdrop() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const markReady = () => {
      if (!cancelled) setReady(true);
    };

    const tryPlay = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
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
  }, []);

  return (
    <div className="ws-shell-video" aria-hidden="true" data-ready={ready ? "1" : "0"}>
      <video
        ref={videoRef}
        className="ws-shell-video-el"
        src={HERO_VIDEO_SRC}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
      />
      <div className="ws-shell-video-blur" />
      <div className="ws-shell-video-scrim" />
    </div>
  );
}
