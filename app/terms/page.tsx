import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/legal-doc";
import "../legal.css";

export const metadata: Metadata = {
  title: "Terms of Service · Octivate",
  description:
    "Terms governing use of Octivate, the Caribbean decision-intelligence platform operated by CENSII.",
};

export default function TermsPage() {
  return <LegalDoc doc="terms" />;
}
