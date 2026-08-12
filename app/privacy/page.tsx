import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/legal-doc";
import "../legal.css";

export const metadata: Metadata = {
  title: "Privacy Policy · Octivate",
  description:
    "How CENSII processes personal data when you use Octivate — accounts, cookies, mailing list, and analysis workflows.",
};

export default function PrivacyPage() {
  return <LegalDoc doc="privacy" />;
}
