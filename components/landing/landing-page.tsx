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
import { useT } from "@/components/i18n/locale-provider";

const SAMPLE_BRIEF = "/sample/brief";

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
  const t = useT();

  const whyPoints = [t("land.why.1"), t("land.why.2"), t("land.why.3"), t("land.why.4")];
  const lenses = [
    {
      key: "power",
      label: t("land.lenses.power"),
      title: t("land.lenses.power.q"),
      body: t("land.lenses.power.body"),
    },
    {
      key: "systems",
      label: t("land.lenses.systems"),
      title: t("land.lenses.systems.q"),
      body: t("land.lenses.systems.body"),
    },
    {
      key: "narratives",
      label: t("land.lenses.narratives"),
      title: t("land.lenses.narratives.q"),
      body: t("land.lenses.narratives.body"),
    },
  ] as const;
  const howSteps = [
    { n: "01", title: t("land.how.01.title"), body: t("land.how.01.body") },
    { n: "02", title: t("land.how.02.title"), body: t("land.how.02.body") },
    { n: "03", title: t("land.how.03.title"), body: t("land.how.03.body") },
  ] as const;
  const disciplines = [
    { title: t("land.disc.1.title"), body: t("land.disc.1.body"), tone: "power" as const },
    { title: t("land.disc.2.title"), body: t("land.disc.2.body"), tone: "systems" as const },
    { title: t("land.disc.3.title"), body: t("land.disc.3.body"), tone: "power" as const },
    { title: t("land.disc.4.title"), body: t("land.disc.4.body"), tone: "narratives" as const },
    { title: t("land.disc.5.title"), body: t("land.disc.5.body"), tone: "systems" as const },
    { title: t("land.disc.6.title"), body: t("land.disc.6.body"), tone: "power" as const },
  ];

  return (
    <>
      <div className="landing-root phase1-landing">
        <LandingParallax />

        <section className="hero" id="landing-hero">
          <DitherBackground className="hero-dither" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <h1 className="reveal in">{t("land.hero.title")}</h1>
              <p className="sub reveal in">{t("land.hero.body")}</p>
              <div className="hero-cta reveal in">
                <Link className="btn btn-primary" href="/signup">
                  {t("land.hero.ctaPrimary")}
                </Link>
                <Link className="btn btn-ghost" href={SAMPLE_BRIEF}>
                  {t("land.hero.ctaSample")}
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
              <span className="eyebrow">{t("land.why.eyebrow")}</span>
              <h2>{t("land.why.title")}</h2>
            </div>
            <ol className="phase1-why-list reveal">
              {whyPoints.map((point, i) => (
                <li key={point}>
                  <span className="phase1-why-n">{i + 1}</span>
                  <p>{point}</p>
                </li>
              ))}
            </ol>
            <p className="phase1-why-close reveal">{t("land.why.close")}</p>
          </div>
        </section>

        <section className="section phase1-lenses" id="lenses">
          <div className="container">
            <div className="section-head reveal">
              <h2>{t("land.lenses.title")}</h2>
              <p className="lede">{t("land.lenses.lede")}</p>
            </div>
            <div className="phase1-imagery reveal" data-parallax-panel>
              {lenses.map((lens) => (
                <div key={lens.key} className={`phase1-imagery-card is-${lens.key}`}>
                  <span>{lens.label}</span>
                  <p>
                    <strong className="phase1-lens-q">{lens.title}</strong>
                    {lens.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section phase1-how" id="how">
          <div className="container">
            <div className="section-head reveal">
              <span className="eyebrow">{t("land.how.eyebrow")}</span>
              <h2>{t("land.how.title")}</h2>
            </div>
            <div className="phase1-steps reveal">
              {howSteps.map((step, i) => (
                <div key={step.n} className="phase1-step">
                  <div className="phase1-step-n">{step.n}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  {i < howSteps.length - 1 && <span className="phase1-step-line" aria-hidden />}
                </div>
              ))}
            </div>
            <div className="phase1-how-cta reveal">
              <Link className="btn btn-primary" href={SAMPLE_BRIEF}>
                <FileText className="h-4 w-4" aria-hidden />
                {t("land.how.ctaSample")}
              </Link>
            </div>
          </div>
        </section>

        <section className="section phase1-disciplines" id="disciplines">
          <div className="container">
            <div className="section-head reveal">
              <span className="eyebrow">{t("land.disc.eyebrow")}</span>
              <h2>{t("land.disc.title")}</h2>
              <p className="lede">{t("land.disc.lede")}</p>
            </div>
            <div className="phase1-discipline-grid reveal">
              {disciplines.map((d) => (
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
                <span className="eyebrow">{t("land.cta.eyebrow")}</span>
                <h2>{t("land.cta.title")}</h2>
                <p className="lede">{t("land.cta.body")}</p>
              </div>
              <div className="phase1-contact-actions">
                <Link className="btn btn-primary" href="/signup">
                  <Mail className="h-4 w-4" aria-hidden />
                  {t("land.cta.create")}
                </Link>
                <Link className="btn btn-ghost" href={SAMPLE_BRIEF}>
                  {t("land.cta.sample")}
                </Link>
              </div>
              <p className="phase1-contact-email">
                {t("land.cta.emailPrefix")}{" "}
                <a href="mailto:info@octivate.co">info@octivate.co</a>
              </p>
            </div>
          </div>
        </section>

        <MailingListSection />

        <section className="section phase1-about" id="about">
          <div className="container phase1-about-inner reveal">
            <OctivateLogo variant="lockup" height={48} />
            <p>{t("land.about.body")}</p>
            <div className="phase1-about-links">
              <a href="https://censii.co" target="_blank" rel="noopener noreferrer">
                {t("land.about.censii")}
              </a>
              <Link href="/support">{t("land.about.team")}</Link>
            </div>
          </div>
        </section>
      </div>

      <button
        type="button"
        className="land-mail-fab"
        aria-label={t("land.mail.fab")}
        onClick={() => openMailingListModal()}
      >
        <Mail className="h-5 w-5" aria-hidden />
      </button>

      <MailingListModal autoOpen />
    </>
  );
}
