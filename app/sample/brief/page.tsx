import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BriefDocument } from "@/components/briefs/brief-document";
import { Card } from "@/components/ui/card";
import { SEED_BRIEFS } from "@/lib/mock/seed";
import "@/app/sample/sample-brief.css";

export const metadata: Metadata = {
  title: "Sample brief — Octivate",
  description:
    "Read-only example of an Octivate decision brief — recommendations, evidence gaps, and Power–Systems–Narratives analysis.",
};

export default function SampleBriefPage() {
  const brief = SEED_BRIEFS.find((b) => b.id === "brief_001");

  if (!brief) {
    return (
      <div className="sample-brief-page">
        <div className="sample-brief-inner">
          <Card className="p-6">
            <h1 className="font-display text-2xl font-bold text-foam">Sample brief unavailable</h1>
            <p className="mt-2 text-sm text-mist">The example brief could not be loaded.</p>
            <Link href="/" className="sample-brief-back mt-4 inline-flex">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to home
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="sample-brief-page">
      <div className="sample-brief-inner">
        <Link href="/" className="sample-brief-back">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>

        <header className="sample-brief-head">
          <div>
            <p className="sample-brief-kicker">Sample decision brief</p>
            <h1 className="sample-brief-title">{brief.title}</h1>
            <p className="sample-brief-meta">
              {brief.country} · {brief.sector} · Project Guyana Energy Entry
            </p>
          </div>
          <Card className="sample-brief-confidence">
            <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
              Confidence
            </span>
            <strong className="font-display text-3xl font-bold text-tide">{brief.confidence}%</strong>
          </Card>
        </header>

        <BriefDocument brief={brief} />

        <Card className="sample-brief-cta">
          <div>
            <h2 className="font-display text-lg font-bold text-foam">
              Ready to run your own decision brief?
            </h2>
            <p className="mt-1 text-sm text-mist">
              Sign in to explore the workspace or request a demo to see Octivate on your question.
            </p>
          </div>
          <div className="sample-brief-cta-actions">
            <Link href="/login" className="sample-brief-cta-primary">
              Sign in
            </Link>
            <Link href="/#request-demo" className="sample-brief-cta-ghost">
              Request a demo
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
