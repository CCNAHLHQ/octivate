"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/locale-provider";
import { LEGAL_DOC_SPECS, type LegalDocId } from "@/lib/i18n/registry/legal";

type Props = {
  doc: LegalDocId;
};

function LegalAccentArt() {
  return (
    <svg className="legal-art" viewBox="0 0 640 72" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        d="M8 48 C 80 18, 140 62, 220 36 S 360 8, 420 40 S 540 66, 632 28"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.55"
        d="M8 58 C 100 34, 170 70, 250 48 S 400 20, 480 52 S 580 70, 632 44"
      />
      <circle cx="220" cy="36" r="3.2" fill="currentColor" />
      <circle cx="420" cy="40" r="2.6" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

export function LegalDoc({ doc }: Props) {
  const t = useT();
  const spec = LEGAL_DOC_SPECS[doc];

  return (
    <article className="legal-page">
      <div className="legal-inner">
        <LegalAccentArt />
        <p className="legal-kicker">{t("legal.kicker")}</p>
        <h1 className="legal-title">{t(spec.titleKey)}</h1>
        <p className="legal-updated">
          {t("legal.lastUpdated")}: {t("legal.updatedDate")}
        </p>

        <div className="legal-prose">
          {spec.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-h`}>
              <h2 id={`${section.id}-h`}>{t(section.titleKey)}</h2>
              {section.paragraphKeys.map((key) => (
                <p key={key}>{t(key)}</p>
              ))}
              {section.bulletKeys?.length ? (
                <ul>
                  {section.bulletKeys.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="legal-foot">
          <Link className="btn btn-ghost" href="/">
            {t("legal.backHome")}
          </Link>
          <a className="btn btn-ghost" href="mailto:info@octivate.co">
            {t("legal.contact")}
          </a>
        </div>
      </div>
    </article>
  );
}
