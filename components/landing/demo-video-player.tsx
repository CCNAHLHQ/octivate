"use client";

import { useEffect, useRef } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

const DEMO_SRC = "/media/octivate-demo.mp4";

type Props = {
  title: string;
  active: boolean;
};

/**
 * SaaS-grade HTML5 player (Plyr) for the landing demo.
 * Autoplay starts on modal open — click-to-open counts as a user gesture.
 */
export function DemoVideoPlayer({ title, active }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const player = new Plyr(el, {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "settings",
        "fullscreen",
      ],
      settings: ["speed"],
      speed: { selected: 1, options: [0.75, 1, 1.25, 1.5] },
      invertTime: false,
      keyboard: { focused: true, global: false },
      tooltips: { controls: true, seek: true },
      hideControls: true,
      resetOnEnd: false,
      ratio: "16:9",
      autopause: true,
      storage: { enabled: false },
    });
    playerRef.current = player;

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (active) {
      const start = async () => {
        try {
          player.currentTime = 0;
          player.muted = false;
          await player.play();
        } catch {
          // Autoplay with sound blocked — fall back to muted autoplay.
          try {
            player.muted = true;
            await player.play();
          } catch {
            /* user can press play */
          }
        }
      };
      // Wait for modal fade-in before starting playback.
      const id = window.setTimeout(() => {
        void start();
      }, 240);
      return () => window.clearTimeout(id);
    }

    player.pause();
    try {
      player.currentTime = 0;
    } catch {
      /* ignore */
    }
  }, [active]);

  return (
    <div className="land-tech-plyr">
      <video
        ref={videoRef}
        className="land-tech-plyr-video"
        playsInline
        preload="metadata"
        controls
        title={title}
      >
        <source src={DEMO_SRC} type="video/mp4" />
      </video>
    </div>
  );
}
