"use client";

import { useEffect, useRef, useState } from "react";
import { bindAutoplayBackdrop } from "@/lib/media/autoplay-backdrop";

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
    return bindAutoplayBackdrop(video, () => setReady(true));
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
