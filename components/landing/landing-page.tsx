"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Mail, FileText } from "lucide-react";
import { OctivateLogo } from "@/components/brand";
import { HeroDottedGlobe } from "@/components/landing/hero-dotted-globe";
import { DitherBackground } from "@/components/landing/dither-background";
import { LandingParallax } from "@/components/landing/landing-parallax";
import {
  MailingListModal,
  MailingListSection,
  openMailingListModal,
} from "@/components/landing/mailing-list";

const SAMPLE_BRIEF = "/sample/brief";

const HOW_STEPS = [
  {
    n: "01",
    title: "Frame the decision",
    body: "We clarify what must be decided, the timeframe, assumptions and what evidence would change the answer.",
  },
  {
    n: "02",
    title: "Find and test the evidence",
    body: "Octivate examines curated open-source intelligence, Caribbean context sources and user-provided material, compares claims, identifies contradictions and shows what remains uncertain.",
  },
  {
    n: "03",
    title: "Deliver action-ready judgement",
    body: "The user receives options, trade-offs, likely outcomes, stakeholder considerations, evidence gaps and signals to monitor. Recommended actions are informed by Caribbean context-specific approaches to stakeholder engagement and strategic communication, integrated into Octivate’s analytical framework.",
  },
] as const;

const DISCIPLINES = [
  {
    title: "Political economy and geopolitical analysis",
    body: "Examining how political authority, economic interests and external pressures shape decisions and likely outcomes. It distinguishes formal authority from the relationships and incentives through which power is exercised in practice.",
    tone: "power" as const,
  },
  {
    title: "Systems and anticipatory analysis",
    body: "Mapping the infrastructure, rules, dependencies and feedback loops that define the operating environment, and examining how those systems may evolve by identifying emerging signals and plausible developments.",
    tone: "systems" as const,
  },
  {
    title: "Stakeholder analysis and engagement",
    body: "Identifying the actors who can obstruct, reshape or legitimise a decision. Octivate assesses their interests, influence, relationships and likely responses, then recommends appropriate engagement approaches, sequencing and coalition-building strategies.",
    tone: "power" as const,
  },
  {
    title: "Narrative monitoring and strategic communication",
    body: "Continuous tracking of issue framing across official communication channels and interpretation in public discourses. It assesses how narratives affect legitimacy, stakeholder behaviour and implementation, and informs communication strategies suited to the Caribbean context.",
    tone: "narratives" as const,
  },
  {
    title: "Open-source intelligence and validation",
    body: "Collecting and verifying publicly available information, and evaluating source authority, to corroborate claims, identify contradictions and gather evidence.",
    tone: "systems" as const,
  },
  {
    title: "Decision analysis and options assessment",
    body: "Brings the evidence and analytical lenses together around the decision itself. Octivate compares available options, tests assumptions, assesses trade-offs and likely consequences, identifies evidence gaps and produces recommended actions and signals to monitor.",
    tone: "power" as const,
  },
] as const;

const WHY_POINTS = [
  "Regional sources are fragmented across institutions and jurisdictions.",
  "Important context often appears outside formal datasets.",
  "Small-state relationships can make individual actors unusually consequential.",
  "Regional, international and domestic dynamics frequently overlap.",
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

export function LandingPage() {
  useReveal();

  return (
    <>
      <div className="landing-root phase1-landing">
        <LandingParallax />

        <section className="hero" id="landing-hero">
          <DitherBackground className="hero-dither" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow reveal in phase1-kicker">
                Clarity for the decisions that shape the Caribbean.
              </p>
              <h1 className="reveal in">
                In a region overflowing with competing signals, the hard part is knowing what they
                mean together.
              </h1>
              <p className="sub reveal in">
                Octivate connects scattered regional information, tests what can be trusted and turns
                it into evidence-backed judgement for the decisions that cannot wait.
              </p>
              <div className="hero-cta reveal in">
                <Link className="btn btn-primary" href="/signup">
                  Request a Demo
                </Link>
                <Link className="btn btn-ghost" href={SAMPLE_BRIEF}>
                  See a Sample brief
                </Link>
              </div>
            </div>
            <div className="hero-visual reveal in">
              <HeroDottedGlobe />
            </div>
          </div>
        </section>

      <section className="section phase1-why" id="why">
        <div className="container phase1-split">
          <div className="section-head reveal">
            <span className="eyebrow">Why Octivate</span>
            <h2>Built for the way information actually moves in the Caribbean.</h2>
          </div>
          <div className="phase1-imagery reveal" data-parallax-panel>
            <div className="phase1-imagery-card is-power">
              <span>Power</span>
              <p>Authority, incentives, coalitions</p>
            </div>
            <div className="phase1-imagery-card is-systems">
              <span>Systems</span>
              <p>Infrastructure, rules, capacity</p>
            </div>
            <div className="phase1-imagery-card is-narratives">
              <span>Narratives</span>
              <p>Framing, legitimacy, sentiment</p>
            </div>
          </div>
          <ol className="phase1-why-list reveal">
            {WHY_POINTS.map((point, i) => (
              <li key={point}>
                <span className="phase1-why-n">{i + 1}</span>
                <p>{point}</p>
              </li>
            ))}
          </ol>
          <p className="phase1-why-close reveal">
            Octivate is designed around this operating reality rather than adapting a generic global
            intelligence product to the region afterwards.
          </p>
        </div>
      </section>

      <section className="section phase1-how" id="how">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow">How Octivate works</span>
            <h2>From a difficult operating context question to decision-ready judgement.</h2>
          </div>
          <div className="phase1-steps reveal">
            {HOW_STEPS.map((step, i) => (
              <div key={step.n} className="phase1-step">
                <div className="phase1-step-n">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                {i < HOW_STEPS.length - 1 && <span className="phase1-step-line" aria-hidden />}
              </div>
            ))}
          </div>
          <div className="phase1-how-cta reveal">
            <Link className="btn btn-primary" href={SAMPLE_BRIEF}>
              <FileText className="h-4 w-4" aria-hidden />
              View a Sample Brief
            </Link>
          </div>
        </div>
      </section>

      <section className="section phase1-disciplines" id="disciplines">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow">Six Disciplines Integrated</span>
            <h2>
              Octivate analyses the Power, Systems and Narratives dimensions as an integrated whole,
              identifying the interactions most likely to shape the decision and its outcomes.
            </h2>
            <p className="lede">
              Octivate’s Power–Systems–Narratives model is supported by six analytical disciplines.
              Together, they explain what is happening, why it matters, what is likely to happen next
              and how an organisation should respond.
            </p>
          </div>
          <div className="phase1-discipline-grid reveal">
            {DISCIPLINES.map((d) => (
              <article key={d.title} className={`phase1-discipline is-${d.tone}`}>
                <h3>{d.title}</h3>
                <p>{d.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section phase1-contact" id="contact">
        <div className="container phase1-contact-wrap">
          <div className="phase1-contact-card reveal">
            <div className="phase1-contact-glint" aria-hidden="true" />
            <div className="section-head phase1-contact-copy">
              <span className="eyebrow">Request a Demo</span>
              <h2>What decision are you trying to make?</h2>
              <p className="lede">
                Share the decision, territory and timeframe. Octivate will help structure the
                question, identify what evidence is needed and provide judgement that can guide your
                next move.
              </p>
            </div>
            <div className="phase1-contact-actions">
              <Link className="btn btn-primary" href="/signup">
                <Mail className="h-4 w-4" aria-hidden />
                Request a pilot brief
              </Link>
              <Link className="btn btn-ghost" href={SAMPLE_BRIEF}>
                View example brief
              </Link>
            </div>
            <p className="phase1-contact-email">
              Or email <a href="mailto:info@censii.co">info@censii.co</a>
            </p>
          </div>
        </div>
      </section>

      <MailingListSection />

      <section className="section phase1-about" id="about">
        <div className="container phase1-about-inner reveal">
          <OctivateLogo variant="lockup" height={48} />
          <p>
            Octivate is the decision-intelligence platform developed by CENSII, a Caribbean
            operating-context intelligence and advisory firm. It brings fragmented regional evidence
            into one structured view, helping organisations make better decisions across complex
            Caribbean environments.
          </p>
          <div className="phase1-about-links">
            <a href="https://censii.co" target="_blank" rel="noopener noreferrer">
              About CENSII
            </a>
            <Link href="/support">Our team</Link>
          </div>
        </div>
      </section>
      </div>

      <button
        type="button"
        className="land-mail-fab"
        aria-label="Join the mailing list"
        onClick={() => openMailingListModal()}
      >
        <Mail className="h-5 w-5" aria-hidden />
      </button>

      <MailingListModal autoOpen />
    </>
  );
}
