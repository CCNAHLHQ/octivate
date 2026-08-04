/** Inline SVG art for design-partner pilot chips — no external icon font deps */

import type { ReactElement } from "react";

export type PartnerPilot = {
  id: string;
  label: string;
  accent: string;
  glow: string;
  Glyph: (props: { className?: string }) => ReactElement;
};

function MinistryGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M6 26V12l10-6 10 6v14H6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <path d="M12 26V18h8v8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 6v4M11 9h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="16" cy="14" r="2" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

function MultilateralGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
      <ellipse cx="16" cy="16" rx="9" ry="3.5" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
      <path d="M16 7v18M7 16h18" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <circle cx="16" cy="7" r="1.5" fill="currentColor" />
      <circle cx="25" cy="16" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="16" cy="25" r="1.5" fill="currentColor" opacity="0.65" />
      <circle cx="7" cy="16" r="1.5" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

function InvestorGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M6 24V14l6-4 6 3 8-5v16H6Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 22l5-6 4 3 7-9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M21 10h3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgrammeGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M16 26c-6-3.5-10-8.5-10-14a6 6 0 0 1 10-4 6 6 0 0 1 10 4c0 5.5-4 10.5-10 14Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path d="M12 14l3 3 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DiplomaticGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M8 26V11l8-5 8 5v15H8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 11h16" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path
        d="M16 8v18"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeDasharray="2 2"
        opacity="0.45"
      />
      <circle cx="16" cy="18" r="3.5" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.15" />
      <path d="M14.5 18h3M16 16.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function UnderwritingGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M16 5l9 4v8c0 5.5-3.8 9.6-9 11-5.2-1.4-9-5.5-9-11V9l9-4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.07"
      />
      <path
        d="M11.5 16l3 3 6.5-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const PARTNER_PILOTS: PartnerPilot[] = [
  {
    id: "ministry",
    label: "Ministry pilot",
    accent: "#D8B4FE",
    glow: "rgba(168, 85, 247, 0.35)",
    Glyph: MinistryGlyph,
  },
  {
    id: "multilateral",
    label: "Multilateral desk",
    accent: "#7DEDE0",
    glow: "rgba(45, 212, 191, 0.32)",
    Glyph: MultilateralGlyph,
  },
  {
    id: "investor",
    label: "Regional investor",
    accent: "#BBD0FF",
    glow: "rgba(120, 160, 255, 0.32)",
    Glyph: InvestorGlyph,
  },
  {
    id: "programme",
    label: "Development programme",
    accent: "#FFA79C",
    glow: "rgba(255, 107, 91, 0.28)",
    Glyph: ProgrammeGlyph,
  },
  {
    id: "diplomatic",
    label: "Diplomatic mission",
    accent: "#F5B84B",
    glow: "rgba(245, 184, 75, 0.28)",
    Glyph: DiplomaticGlyph,
  },
  {
    id: "underwriting",
    label: "Underwriting team",
    accent: "#A855F7",
    glow: "rgba(168, 85, 247, 0.3)",
    Glyph: UnderwritingGlyph,
  },
];
