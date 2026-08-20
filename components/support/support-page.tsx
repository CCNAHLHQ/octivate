"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ExternalLink, Users } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";
import type { PresenceStatus, StaffProfileId } from "@/lib/auth/types";
import {
  founderDescKey,
  founderPresenceKey,
  founderRoleKey,
  type PublicFounder,
} from "@/lib/support/founder-meta";
import { cn } from "@/lib/utils";

/** Visible-tab cadence — snappy presence without hammering the API. */
const POLL_VISIBLE_MS = 4_000;
const POLL_HIDDEN_MS = 30_000;

const TONE_ACCENT: Record<PublicFounder["tone"], string> = {
  violet: "var(--violet)",
  tide: "var(--tide)",
  coral: "var(--coral)",
};

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

function FounderAvatar({
  founder,
  size = "lg",
}: {
  founder: PublicFounder;
  size?: "lg" | "sm";
}) {
  const t = useT();
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(founder.avatarUrl) && !broken;
  const presence = founder.presenceStatus || "available";

  useEffect(() => {
    setBroken(false);
  }, [founder.avatarUrl]);

  return (
    <span
      className={cn(
        "support-avatar",
        size === "sm" && "is-sm",
        `is-${founder.tone}`,
        `is-presence-${presence}`
      )}
      style={{ "--member-accent": TONE_ACCENT[founder.tone] } as React.CSSProperties}
      title={`${founder.name} · ${t(founderPresenceKey(presence))}`}
    >
      <span className="support-avatar-face">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={founder.avatarUrl!}
            alt=""
            className="support-avatar-img"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="support-avatar-fallback" aria-hidden>
            {founder.initials}
          </span>
        )}
      </span>
      <span
        className={cn("support-avatar-presence", `is-${presence}`)}
        aria-label={t(founderPresenceKey(presence))}
      />
    </span>
  );
}

function signature(list: PublicFounder[]) {
  return list
    .map((f) => `${f.id}:${f.avatarUrl || ""}:${f.presenceStatus || "available"}`)
    .join("|");
}

export function SupportPage() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  useReveal();
  const [founders, setFounders] = useState<PublicFounder[]>([]);
  const sigRef = useRef("");

  const loadFounders = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/public/founders", {
        cache: "no-store",
        signal,
      });
      if (!res.ok) return;
      const data = (await res.json()) as { founders?: PublicFounder[] };
      if (!Array.isArray(data.founders)) return;
      const nextSig = signature(data.founders);
      if (nextSig === sigRef.current) return;
      sigRef.current = nextSig;
      setFounders(data.founders);
    } catch {
      /* aborted / offline */
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadFounders(ac.signal);

    let timer: number | null = null;
    const schedule = () => {
      if (timer) window.clearInterval(timer);
      const ms =
        document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
      timer = window.setInterval(() => {
        void loadFounders();
      }, ms);
    };
    schedule();

    const onVis = () => {
      schedule();
      if (document.visibilityState === "visible") void loadFounders();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      ac.abort();
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadFounders]);

  const ordered: PublicFounder[] =
    founders.length > 0
      ? founders
      : (["shemuel", "jaden"] as StaffProfileId[]).map((id, i) => ({
          id,
          name: id === "shemuel" ? "Shemuel" : "Jaden",
          role: "",
          tone: (["violet", "coral"] as const)[i],
          avatarUrl: null,
          initials: id.slice(0, 2).toUpperCase(),
          presenceStatus: "offline" as PresenceStatus,
        }));

  return (
    <div className="landing-root">
      <section className="support-hero container">
        <p className="eyebrow reveal in">
          <Users className="inline h-3.5 w-3.5 text-violet opacity-80" aria-hidden />
          {t("support.page.eyebrow")}
        </p>
        <h1 className="reveal in">{t("support.page.headline")}</h1>
      </section>

      <section className="support-section container">
        <div className="support-founders-band reveal in">
          <div className="support-founders-portraits" aria-hidden>
            {ordered.map((f) => (
              <FounderAvatar key={f.id} founder={f} size="lg" />
            ))}
          </div>
          <h2 className="support-founders-title">{t("support.page.foundersTitle")}</h2>
          <p className="support-founders-lede">{t("support.page.foundersLede")}</p>
          <a href="#team-members" className="support-founders-cta">
            {t("support.page.meetTeam")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </section>

      <section
        id="team-members"
        className="support-section container"
        aria-label={t("support.page.meetTeam")}
      >
        <ul className="support-member-rows">
          {ordered.map((member, i) => {
            const presence = member.presenceStatus || "available";
            return (
              <motion.li
                key={member.id}
                className="support-member-row"
                style={{ "--member-accent": TONE_ACCENT[member.tone] } as React.CSSProperties}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { ...spring, delay: 0.06 + i * 0.08 }}
              >
                <FounderAvatar founder={member} size="sm" />
                <div className="support-member-row-body">
                  <div className="support-member-row-head">
                    <h3 className="support-member-name">{member.name}</h3>
                    <p className="support-member-role">
                      {t(founderRoleKey(member.id))}
                    </p>
                    <span className={cn("support-member-status", `is-${presence}`)}>
                      <span
                        className={cn("support-member-status-dot", `is-${presence}`)}
                        aria-hidden
                      />
                      {t(founderPresenceKey(presence))}
                    </span>
                  </div>
                  <p className="support-member-line">{t(founderDescKey(member.id))}</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </section>

      <section className="support-section container pb-24">
        <div className="support-foot">
          <div className="support-foot-glow" aria-hidden />
          <div className="support-foot-inner">
            <p>{t("support.page.needWorkspace")}</p>
            <div className="support-foot-actions">
              <Link href="/signup" className="btn btn-primary btn-sm">
                {t("support.page.createAccount")}
              </Link>
              <Link href="/dashboard" className="btn btn-ghost btn-sm">
                {t("support.page.openWorkspace")}
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
