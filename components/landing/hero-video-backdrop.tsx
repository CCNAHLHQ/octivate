"use client";

import { useEffect, useRef, useState } from "react";

/** Local self-hosted hero plate (served from /public). */
export const HERO_VIDEO_SRC = "/media/hero/clarity-caribbean.mp4";

/**
 * Full-bleed hero backdrop: local MP4, muted autoplay loop,
 * with a slight animated (non-static) blur veil over the plate.
 */
export function HeroVideoBackdrop() {
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
    <div className="hero-video" aria-hidden="true" data-ready={ready ? "1" : "0"}>
      <video
        ref={videoRef}
        className="hero-video-el"
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
      {/* Breathing blur over the moving plate — not a static frosted sheet */}
      <div className="hero-video-blur" />
      <div className="hero-video-scrim" />
    </div>
  );
}
