"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Play, X } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

const DemoVideoPlayer = dynamic(
  () =>
    import("@/components/landing/demo-video-player").then((m) => m.DemoVideoPlayer),
  { ssr: false }
);

type TechItem = {
  id: string;
  label: string;
  mark: ReactNode;
};

/** Brand marks (Simple Icons / brand geometry), tinted via currentColor. */
function OpenRouterMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="land-tech-mark">
      <path
        fill="currentColor"
        d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z"
      />
    </svg>
  );
}

function ClaudeMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="land-tech-mark">
      <path
        fill="currentColor"
        d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"
      />
    </svg>
  );
}

function ChatGptMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="land-tech-mark">
      <path
        fill="currentColor"
        d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
      />
    </svg>
  );
}

function PaypalMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="land-tech-mark">
      <path
        fill="currentColor"
        d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"
      />
    </svg>
  );
}

function BitcoinMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="land-tech-mark">
      <path
        fill="currentColor"
        d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z"
      />
    </svg>
  );
}

/** OxaPay infinity mark — currentColor so hover lighting matches peers. */
function OxaPayMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="land-tech-mark" fill="none">
      <path
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 12c0-2.35 1.9-4.25 4.25-4.25 1.55 0 2.85.8 3.55 2 .7-1.2 2-2 3.55-2 2.35 0 4.25 1.9 4.25 4.25s-1.9 4.25-4.25 4.25c-1.55 0-2.85-.8-3.55-2-.7 1.2-2 2-3.55 2-2.35 0-4.25-1.9-4.25-4.25z"
      />
    </svg>
  );
}

function BrandImgMark({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="land-tech-mark is-bitmap" aria-hidden>
      <Image src={src} alt={alt} width={28} height={28} unoptimized />
    </span>
  );
}

const TECH: TechItem[] = [
  { id: "openrouter", label: "OpenRouter", mark: <OpenRouterMark /> },
  { id: "claude", label: "Claude", mark: <ClaudeMark /> },
  { id: "chatgpt", label: "ChatGPT", mark: <ChatGptMark /> },
  {
    id: "cursor",
    label: "Cursor",
    mark: <BrandImgMark src="/brands/cursor.svg" alt="Cursor" />,
  },
  {
    id: "higgsfield",
    label: "Higgsfield",
    mark: <BrandImgMark src="/brands/higgsfield.png" alt="Higgsfield" />,
  },
  { id: "paypal", label: "PayPal", mark: <PaypalMark /> },
  { id: "oxapay", label: "OxaPay", mark: <OxaPayMark /> },
  { id: "bitcoin", label: "Bitcoin", mark: <BitcoinMark /> },
];

function TechLogoItem({ item, inert }: { item: TechItem; inert?: boolean }) {
  return (
    <li className="land-tech-logo" data-tech={item.id} aria-hidden={inert || undefined}>
      <span className="land-tech-logo-inner" title={item.label}>
        {item.mark}
        <span className="land-tech-logo-label">{item.label}</span>
      </span>
    </li>
  );
}

function DemoPreviewArt() {
  return (
    <div className="land-tech-demo-art" aria-hidden>
      <div className="land-tech-demo-chart is-bars">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="land-tech-demo-chart is-area">
        <svg viewBox="0 0 80 36" preserveAspectRatio="none">
          <path
            d="M0 28 C12 24 18 12 30 14 C42 16 48 6 58 8 C68 10 74 18 80 12 V36 H0 Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="land-tech-demo-avatar">
        <svg viewBox="0 0 48 48" aria-hidden>
          <circle className="land-tech-avatar-bg" cx="24" cy="24" r="24" />
          <circle className="land-tech-avatar-fg" cx="24" cy="18" r="7" />
          <path className="land-tech-avatar-fg" d="M10 42c2-9 9-14 14-14s12 5 14 14" />
        </svg>
      </div>
    </div>
  );
}

const FADE_MS = 220;

function DemoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => setMounted(true), []);

  const requestClose = useCallback(() => {
    setLeaving((already) => {
      if (already) return already;
      setVisible(false);
      window.setTimeout(() => {
        setLeaving(false);
        onClose();
      }, FADE_MS);
      return true;
    });
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setLeaving(false);
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open && !leaving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, leaving, requestClose]);

  if (!mounted || (!open && !leaving)) return null;

  return createPortal(
    <div
      className={cn(
        "land-tech-modal-root",
        visible && !leaving && "is-open",
        leaving && "is-leaving"
      )}
      role="presentation"
    >
      <button
        type="button"
        className="land-tech-modal-backdrop"
        aria-label={t("land.tech.demoClose")}
        onClick={requestClose}
      />
      <div
        className="land-tech-modal-panel is-video"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="land-tech-modal-head">
          <div>
            <p className="land-tech-modal-kicker">{t("land.tech.demoKicker")}</p>
            <h2 id={titleId}>{t("land.tech.demoTitle")}</h2>
          </div>
          <button
            type="button"
            className="land-tech-modal-close"
            onClick={requestClose}
            aria-label={t("land.tech.demoClose")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="land-tech-modal-body">
          <DemoVideoPlayer title={t("land.tech.demoTitle")} active={visible && !leaving} />
        </div>
      </div>
    </div>,
    document.body
  );
}

export function TechTrustSection() {
  const t = useT();
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <section className="section land-tech" id="technologies" aria-labelledby="land-tech-heading">
      <div className="container land-tech-inner">
        <p id="land-tech-heading" className="land-tech-heading reveal">
          {t("land.tech.heading")}
        </p>
        <p className="land-tech-lede reveal">{t("land.tech.lede")}</p>

        <div className="land-tech-marquee reveal" aria-label={t("land.tech.heading")}>
          <div className="land-tech-marquee-fade" aria-hidden />
          <div className="land-tech-marquee-viewport">
            <ul className="land-tech-marquee-track">
              {TECH.map((item) => (
                <TechLogoItem key={`a-${item.id}`} item={item} />
              ))}
              {TECH.map((item) => (
                <TechLogoItem key={`b-${item.id}`} item={item} inert />
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          className="land-tech-demo reveal"
          onClick={() => setDemoOpen(true)}
        >
          <span className="land-tech-demo-copy">
            <span className="land-tech-demo-play" aria-hidden>
              <Play className="h-4 w-4" fill="currentColor" />
            </span>
            <span className="land-tech-demo-label">{t("land.tech.demoCta")}</span>
          </span>
          <DemoPreviewArt />
        </button>
      </div>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </section>
  );
}
