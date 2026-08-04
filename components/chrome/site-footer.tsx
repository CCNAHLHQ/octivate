import Link from "next/link";
import { OctivateLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { JurisdictionTicker } from "@/components/chrome/jurisdiction-ticker";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 14 14" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M2 7h9M7.5 3.5L11 7l-3.5 3.5" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <svg className="f-art" viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true">
        <path className="w1" d="M-40 190 C 160 120, 300 210, 500 160 S 900 90, 1240 150" />
        <path className="w1" d="M-40 214 C 180 150, 320 232, 520 186 S 920 118, 1240 176" />
        <path className="w2" d="M-40 170 C 200 96, 360 190, 560 138 S 960 66, 1240 128" />
        <path className="w3" d="M-40 150 C 220 74, 400 170, 600 116 S 1000 44, 1240 106" />
      </svg>

      <JurisdictionTicker />

      <div className="container">
        <div className="f-top">
          <div className="f-brand">
            <Link className="f-brand-link" href="/" aria-label="Octivate home">
              <OctivateLogo variant="lockup" height={40} />
            </Link>
            <p>
              Action-oriented decision intelligence for complex Caribbean operating environments.
            </p>
            <p className="f-about-blurb">
              Octivate is the decision-intelligence platform developed by CENSII, a Caribbean
              operating-context intelligence and advisory firm. It brings fragmented regional
              evidence into one structured view, helping organisations make better decisions across
              complex Caribbean environments.
            </p>
          </div>

          <div className="f-col">
            <h4>Explore</h4>
            <Link href="/#why">
              <ArrowIcon />
              Why Octivate
            </Link>
            <Link href="/#how">
              <ArrowIcon />
              How it works
            </Link>
            <Link href="/#disciplines">
              <ArrowIcon />
              Six Disciplines Integrated
            </Link>
            <Link href="/dashboard/briefs/brief_001">
              <ArrowIcon />
              Sample brief
            </Link>
          </div>

          <div className="f-col">
            <h4>Take action</h4>
            <Link href="/#contact">
              <ArrowIcon />
              Request a Demo
            </Link>
            <Link href="/signin">
              <ArrowIcon />
              Sign in
            </Link>
            <Link href="/pricing">
              <ArrowIcon />
              Pricing
            </Link>
            <a href="mailto:info@censii.co">
              <ArrowIcon />
              Contact us
            </a>
          </div>

          <div className="f-col">
            <h4>About</h4>
            <Link href="/#about">
              <ArrowIcon />
              About Octivate
            </Link>
            <a href="https://censii.co" target="_blank" rel="noopener noreferrer">
              <ArrowIcon />
              About CENSII
            </a>
            <Link href="/support">
              <ArrowIcon />
              Team
            </Link>
          </div>
        </div>

        <div className="f-mark" aria-hidden="true">
          <OctivateLogo variant="lockup" height={64} decorative />
        </div>

        <div className="f-divider" aria-hidden="true" />

        <p className="seo-p">
          Octivate by CENSII delivers Caribbean decision intelligence: Power–Systems–Narratives
          analysis, evidence validation, options assessment and monitoring for organisations
          operating across Trinidad and Tobago, Jamaica, Barbados, Guyana, Suriname, the OECS and
          the wider region.
        </p>

        <div className="f-bar">
          <span>
            © 2026 CENSII <span className="dotsep">·</span> Octivate · octivate.io
          </span>
          <div className="f-bar-actions">
            <ThemeToggle variant="footer" />
            <a className="up" href="#top">
              <svg viewBox="0 0 12 12" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 10V2M2.6 5.4L6 2l3.4 3.4" />
              </svg>
              Back to top
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
