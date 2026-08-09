"use client";

import Link from "next/link";
import { OctivateLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { JurisdictionTicker } from "@/components/chrome/jurisdiction-ticker";
import { useT } from "@/components/i18n/locale-provider";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 14 14" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M2 7h9M7.5 3.5L11 7l-3.5 3.5" />
    </svg>
  );
}

export function SiteFooter() {
  const t = useT();

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
            <p>{t("footer.blurb")}</p>
          </div>

          <div className="f-col">
            <h4>{t("footer.explore")}</h4>
            <Link href="/#why">
              <ArrowIcon />
              {t("footer.why")}
            </Link>
            <Link href="/#how">
              <ArrowIcon />
              {t("footer.how")}
            </Link>
            <Link href="/#disciplines">
              <ArrowIcon />
              {t("footer.disciplines")}
            </Link>
            <Link href="/sample/brief">
              <ArrowIcon />
              {t("footer.sample")}
            </Link>
          </div>

          <div className="f-col">
            <h4>{t("footer.takeAction")}</h4>
            <Link href="/signup">
              <ArrowIcon />
              {t("footer.getStarted")}
            </Link>
            <Link href="/signin">
              <ArrowIcon />
              {t("footer.signIn")}
            </Link>
            <Link href="/pricing">
              <ArrowIcon />
              {t("footer.pricing")}
            </Link>
            <a href="mailto:info@octivate.co">
              <ArrowIcon />
              {t("footer.contact")}
            </a>
          </div>

          <div className="f-col">
            <h4>{t("footer.about")}</h4>
            <a href="https://censii.co" target="_blank" rel="noopener noreferrer">
              <ArrowIcon />
              {t("footer.aboutCensii")}
            </a>
            <Link href="/support">
              <ArrowIcon />
              {t("footer.team")}
            </Link>
          </div>
        </div>

        <div className="f-mark" aria-hidden="true">
          <OctivateLogo variant="lockup" height={64} decorative />
        </div>

        <div className="f-divider" aria-hidden="true" />

        <p className="seo-p">{t("footer.seo")}</p>

        <div className="f-bar">
          <span>{t("footer.copyright")}</span>
          <div className="f-bar-actions">
            <ThemeToggle variant="footer" />
            <a className="up" href="#top">
              <svg viewBox="0 0 12 12" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 10V2M2.6 5.4L6 2l3.4 3.4" />
              </svg>
              {t("footer.backToTop")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
