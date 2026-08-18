"use client";

import { useEffect, useRef, useState } from "react";
import { HERO_VIDEO_SRC } from "@/components/landing/hero-video-backdrop";
import { bindAutoplayBackdrop } from "@/lib/media/autoplay-backdrop";

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
    return bindAutoplayBackdrop(video, () => setReady(true));
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
