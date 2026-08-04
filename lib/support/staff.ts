import { Compass, Cpu, ScrollText, type LucideIcon } from "lucide-react";
import type { StaffProfileId } from "@/lib/auth/types";

export type StaffProfile = {
  id: StaffProfileId;
  name: string;
  email: string;
  role: string;
  tone: "violet" | "tide" | "coral";
  icon: LucideIcon;
};

/** Founders from /support TEAM — single source for auth + support UI. */
export const STAFF_PROFILES: StaffProfile[] = [
  {
    id: "shemuel",
    name: "Shemuel",
    email: "shemuel@octivate.io",
    role: "Founder / Product Lead / Domain Lead",
    tone: "violet",
    icon: Compass,
  },
  {
    id: "nirvana",
    name: "Nirvana",
    email: "nirvana@octivate.io",
    role: "AI Workflow & Validation Lead",
    tone: "tide",
    icon: ScrollText,
  },
  {
    id: "jaden",
    name: "Jaden",
    email: "jaden@octivate.io",
    role: "Technical Architecture & Prototype Lead",
    tone: "coral",
    icon: Cpu,
  },
];

export function staffById(id?: string | null): StaffProfile | null {
  if (!id) return null;
  return STAFF_PROFILES.find((s) => s.id === id) || null;
}

export function staffByEmail(email?: string | null): StaffProfile | null {
  if (!email) return null;
  const e = email.toLowerCase();
  return STAFF_PROFILES.find((s) => s.email.toLowerCase() === e) || null;
}
