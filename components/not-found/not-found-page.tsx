"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Compass,
  LayoutDashboard,
  Mail,
  MapPinOff,
  Radar,
  Users,
} from "lucide-react";

const ROUTES = [
  {
    href: "/",
    lens: "Power",
    icon: Compass,
    title: "Return home",
    description: "Product overview, methodology, and how Octivate structures Caribbean decision intelligence.",
  },
  {
    href: "/dashboard",
    lens: "Systems",
    icon: LayoutDashboard,
    title: "Open workspace",
    description: "Projects, monitors, briefs, and the agent pipeline — where analysis actually runs.",
  },
  {
    href: "/support",
    lens: "Narratives",
    icon: Users,
    title: "Meet the team",
    description: "Credits, contact paths, and support if you need help finding the right entry point.",
  },
] as const;

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

export function NotFoundPage() {
  useReveal();

  return (
    <div className="landing-root nf-page">
      <section className="nf-hero container">
        <div className="nf-hero-grid">
          <div>
            <p className="eyebrow reveal in">
              <MapPinOff className="inline h-3.5 w-3.5 text-coral opacity-90" aria-hidden />
              Evidence gap · 404
            </p>

            <div className="nf-code reveal in" aria-hidden>
              <span className="nf-code-main">404</span>
            </div>

            <h1 className="reveal in">
              This route isn&apos;t on the <span className="grad-text">intelligence map</span>
            </h1>
            <p className="sub reveal in" data-delay="1">
              The URL you requested doesn&apos;t match any published page in Octivate. Like a missing
              source in a brief, the path exists — but the evidence behind it doesn&apos;t.
            </p>

            <div className="nf-actions reveal in" data-delay="2">
              <Link href="/" className="btn btn-primary btn-sm inline-flex items-center gap-2">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back to home
              </Link>
              <Link href="/dashboard" className="btn btn-ghost btn-sm inline-flex items-center gap-2">
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                Workspace
              </Link>
              <a
                href="mailto:info@censii.co"
                className="btn btn-ghost btn-sm inline-flex items-center gap-2"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Contact
              </a>
            </div>
          </div>

          <div className="nf-visual reveal in" data-delay="1" aria-hidden>
            <div className="nf-radar">
              <div className="nf-radar-sweep" />
              <span className="nf-blip nf-blip-1" />
              <span className="nf-blip nf-blip-2" />
              <span className="nf-blip nf-blip-3 is-dead" />
              <div className="nf-radar-core">
                <Radar className="h-5 w-5 text-teal opacity-80" />
                <span className="nf-radar-label">Signal scan</span>
                <span className="nf-radar-status">No match</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nf-routes container">
        <header className="nf-routes-head reveal">
          <h2>Suggested routes</h2>
          <p>
            Power, Systems, and Narratives — the same lenses we use for briefs — mapped to places
            you can go next.
          </p>
        </header>

        <div className="nf-route-grid">
          {ROUTES.map((route, i) => (
            <Link
              key={route.href}
              href={route.href}
              className={`nf-route-card reveal is-${route.lens.toLowerCase()}`}
              data-delay={String(i + 1)}
            >
              <div className="nf-route-top">
                <span className="nf-route-lens">{route.lens}</span>
                <span className="nf-route-icon">
                  <route.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
              </div>
              <span className="nf-route-title">{route.title}</span>
              <span className="nf-route-desc">{route.description}</span>
            </Link>
          ))}
        </div>

        <div className="nf-foot reveal" data-delay="3">
          <p>
            If you followed a link from inside Octivate, the resource may have moved or been
            archived. Try the workspace, or email{" "}
            <a href="mailto:info@censii.co" className="text-teal hover:underline">
              info@censii.co
            </a>{" "}
            with the path you were trying to reach.
          </p>
        </div>
      </section>
    </div>
  );
}
