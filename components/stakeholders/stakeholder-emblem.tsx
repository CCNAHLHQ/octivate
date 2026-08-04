"use client";

import { useId } from "react";
import {
  LOGO_MARK_CIRCLES,
  LOGO_MARK_STAR,
} from "@/components/brand/logo-geometry";
import type { StakeholderEmblem, StakeholderRecognition } from "@/lib/types";
import { cn } from "@/lib/utils";

const RECOGNITION_LABEL: Record<StakeholderRecognition, string> = {
  founding: "Founding",
  patron: "Patron",
  champion: "Champion",
  ally: "Ally",
};

export function StakeholderEmblemArt({
  emblem,
  recognition,
  title,
  className,
}: {
  emblem: StakeholderEmblem;
  recognition: StakeholderRecognition;
  title: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const { purple, coral, blue } = LOGO_MARK_CIRCLES;
  const medalGrad = `sth-medal-${uid}`;
  const ringGrad = `sth-ring-${uid}`;
  const glintClip = `sth-glint-${uid}`;

  return (
    <div className={cn("sth-emblem", `is-${emblem}`, className)} aria-hidden>
      <svg
        className="sth-emblem-svg"
        viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`${title} emblem`}
      >
        <title>{title}</title>
        <defs>
          <radialGradient id={medalGrad} cx="35%" cy="30%" r="70%">
            <stop offset="0%" className="sth-grad-hi" />
            <stop offset="55%" className="sth-grad-mid" />
            <stop offset="100%" className="sth-grad-lo" />
          </radialGradient>
          <linearGradient id={ringGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="sth-ring-a" />
            <stop offset="50%" className="sth-ring-b" />
            <stop offset="100%" className="sth-ring-a" />
          </linearGradient>
          <clipPath id={glintClip}>
            <circle cx="60" cy="60" r="46" />
          </clipPath>
        </defs>

        <g className="sth-medal">
          <circle cx="60" cy="60" r="48" fill={`url(#${medalGrad})`} />
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="none"
            stroke={`url(#${ringGrad})`}
            strokeWidth="2.2"
            className="sth-medal-ring"
          />
          <circle
            cx="60"
            cy="60"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="1"
            strokeDasharray="2 3"
            className="sth-medal-dash"
          />
        </g>

        <g className="sth-mark" transform="translate(16 22)">
          <g opacity="0.9">
            <circle {...coral} className="octivate-logo-circle is-coral" />
            <circle {...blue} className="octivate-logo-circle is-blue" />
            <circle {...purple} className="octivate-logo-circle is-purple" />
          </g>
          <path d={LOGO_MARK_STAR} className="octivate-logo-star sth-mark-star" />
        </g>

        <g clipPath={`url(#${glintClip})`}>
          <g className="sth-glint-track">
            <rect className="sth-glint" x="8" y="-20" width="28" height="160" rx="8" />
          </g>
        </g>
      </svg>
      <span className="sth-medal-label">{RECOGNITION_LABEL[recognition]}</span>
    </div>
  );
}
