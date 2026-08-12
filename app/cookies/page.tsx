import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/legal-doc";
import "../legal.css";

export const metadata: Metadata = {
  title: "Cookie Statement · Octivate",
  description:
    "How Octivate uses essential cookies and optional analytics or marketing preferences.",
};

export default function CookiesPage() {
  return <LegalDoc doc="cookies" />;
}
