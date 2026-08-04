"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Cpu, ScrollText, Compass, ExternalLink, Users } from "lucide-react";
import { LandingIcon } from "@/components/landing/landing-icon";

const TEAM = [
  {
    id: "shemuel",
    name: "Shemuel",
    role: "Founder · Product & Domain",
    accent: "#D8B4FE",
    tone: "violet" as const,
    icon: Compass,
    line: "Product vision, Caribbean use cases, and the CENSII decision methodology.",
  },
  {
    id: "nirvana",
    name: "Nirvana",
    role: "AI Workflow & Validation",
    accent: "#7DEDE0",
    tone: "tide" as const,
    icon: ScrollText,
    line: "Agent workflow design, evidence checks, and demo evaluation.",
  },
  {
    id: "jaden",
    name: "Jaden",
    role: "Technical Architecture",
    accent: "#FFA79C",
    tone: "coral" as const,
    icon: Cpu,
    line: "MVP architecture, prototype delivery, and platform execution.",
  },
] as const;

const spring = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.85 };

function useReveal() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export function SupportPage() {
  const reduceMotion = useReducedMotion();
  useReveal();

  return (
    <div className="landing-root">
      <section className="support-hero container">
        <p className="eyebrow reveal in">
          <Users className="inline h-3.5 w-3.5 text-violet opacity-80" aria-hidden />
          Team
        </p>
        <h1 className="reveal in">
          Built by <span className="grad-text">CENSII</span>
        </h1>
        <p className="sub reveal in" data-delay="1">
          Three leads shipping agentic decision intelligence for Caribbean contexts.
        </p>
      </section>

      <section className="support-section container">
        <div className="support-team-grid">
          {TEAM.map((member, i) => (
            <motion.article
              key={member.id}
              className="support-member"
              style={{ "--member-accent": member.accent } as React.CSSProperties}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { ...spring, delay: 0.08 + i * 0.1 }}
            >
              <div className="support-member-head">
                <LandingIcon icon={member.icon} tone={member.tone} size="lg" />
                <div className="support-member-meta">
                  <h3 className="support-member-name">{member.name}</h3>
                  <p className="support-member-role">{member.role}</p>
                </div>
              </div>
              <p className="support-member-line">{member.line}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="support-section container pb-24">
        <div className="support-foot">
          <div className="support-foot-glow" aria-hidden />
          <div className="support-foot-inner">
            <p>Need a workspace? Open Octivate or visit CENSII.</p>
            <div className="support-foot-actions">
              <Link href="/signup" className="btn btn-primary btn-sm">
                Create account
              </Link>
              <Link href="/dashboard" className="btn btn-ghost btn-sm">
                Open workspace
              </Link>
              <a
                href="https://censii.co"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm inline-flex items-center gap-2"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                censii.co
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
