"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, Menu, Shield, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalAuth } from "@/components/auth/use-optional-auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SiteAlerts } from "@/components/chrome/site-alerts";
import { SiteTranslate } from "@/components/i18n/site-translate";
import { useT } from "@/components/i18n/locale-provider";
import { OctivateLogo } from "@/components/brand";
import { useMounted } from "@/lib/use-mounted";
import type { MessageKey } from "@/lib/i18n/messages";

type NavLink = {
  labelKey: MessageKey;
  href: string;
};

const marketingLinkDefs: NavLink[] = [
  { labelKey: "nav.why", href: "/#why" },
  { labelKey: "nav.how", href: "/#how" },
  { labelKey: "nav.pricing", href: "/pricing" },
  { labelKey: "nav.team", href: "/support" },
  { labelKey: "nav.about", href: "/#about" },
];

/** Hash links active only for the matching hash — never all `/#…` on home. */
function isActive(pathname: string, href: string, hash: string) {
  if (href.startsWith("/#")) {
    if (pathname !== "/") return false;
    return hash === href.slice(1);
  }
  return pathname === href || pathname.startsWith(href + "/");
}

function NavItem({
  link,
  label,
  pathname,
  hash,
  onNavigate,
  mobile,
}: {
  link: NavLink;
  label: string;
  pathname: string;
  hash: string;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const active = isActive(pathname, link.href, hash);

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={cn("site-nav-link", mobile && "is-mobile", active && "is-active")}
      title={label}
      aria-current={active ? "page" : undefined}
    >
      <span className="site-nav-label">{label}</span>
    </Link>
  );
}

/**
 * Global chrome navbar — Phase 1 public labels.
 * Guest: quiet Sign in + Request a Demo.
 * Signed-in on marketing: Return to workspace (+ Operator dashboard when role allows).
 * Theme toggle (lighting) stays available in every state.
 */
export function SiteNavbar() {
  const pathname = usePathname();
  const mounted = useMounted();
  const t = useT();
  const { user, ready } = useOptionalAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hash, setHash] = useState("");
  const inApp = pathname.startsWith("/dashboard") || pathname.startsWith("/operator");
  const signedIn = ready && Boolean(user);
  const isOperator = user?.role === "operator";

  const marketingLinks = useMemo(
    () =>
      marketingLinkDefs.map((link) => ({
        ...link,
        label: t(link.labelKey),
      })),
    [t]
  );

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash || "");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const primaryHref = inApp
    ? "/dashboard/projects"
    : signedIn
      ? "/dashboard"
      : "/#contact";
  const primaryLabel = inApp
    ? t("nav.askQuestion")
    : signedIn
      ? t("nav.returnWorkspace")
      : t("nav.requestDemo");
  const primaryMobileLabel = inApp
    ? t("nav.askQuestionLong")
    : signedIn
      ? t("nav.returnWorkspace")
      : t("nav.requestDemo");
  const PrimaryIcon = signedIn && !inApp ? LayoutDashboard : Sparkles;

  return (
    <div className="site-navbar-root">
      <a className="skip" href="#main">
        {t("nav.skip")}
      </a>
      <header
        className={cn("site-nav", inApp && "in-app", mounted && scrolled && "is-scrolled")}
        id="site-nav"
      >
        <div className="site-nav-inner">
          <Link className="site-brand" href="/" aria-label="Octivate home">
            <OctivateLogo variant="lockup" height={36} />
          </Link>

          {!inApp && (
            <nav className="site-nav-links" aria-label={t("nav.primary")}>
              {marketingLinks.map((l) => (
                <NavItem
                  key={l.href}
                  link={l}
                  label={l.label}
                  pathname={pathname}
                  hash={hash}
                />
              ))}
            </nav>
          )}

          <div className="site-nav-cta">
            <SiteTranslate />
            <ThemeToggle variant="nav" />
            <SiteAlerts />
            {!inApp && ready && signedIn && isOperator ? (
              <Link className="site-nav-operator" href="/dashboard/operator">
                {t("nav.operatorDashboard")}
              </Link>
            ) : null}
            {!inApp && ready && !signedIn ? (
              <Link className="site-nav-signin" href="/signin">
                {t("nav.signIn")}
              </Link>
            ) : null}
            {ready || inApp ? (
              <Link className="btn btn-primary btn-sm site-nav-pilot" href={primaryHref}>
                <PrimaryIcon className="site-nav-ico" aria-hidden strokeWidth={2.25} />
                <span className="site-nav-pilot-label">{primaryLabel}</span>
              </Link>
            ) : (
              <span className="site-nav-cta-slot" aria-hidden />
            )}
            <button
              className="site-menu-btn"
              type="button"
              aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span className="sr-only">
                {mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              </span>
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden strokeWidth={2.25} />
              ) : (
                <Menu className="h-5 w-5" aria-hidden strokeWidth={2.25} />
              )}
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn("site-mobile-backdrop", mobileOpen ? "is-open" : "is-closed")}
        aria-hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
      />

      <nav
        className={cn("site-mobile-sheet", mobileOpen && "is-open")}
        aria-label={t("nav.mobile")}
        aria-hidden={!mobileOpen}
      >
        <div className="site-mobile-sheet-inner">
          {!inApp && (
            <div className="site-mobile-group">
              <p className="site-mobile-group-label">{t("nav.explore")}</p>
              {marketingLinks.map((l) => (
                <NavItem
                  key={l.href}
                  link={l}
                  label={l.label}
                  pathname={pathname}
                  hash={hash}
                  mobile
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </div>
          )}

          <div className="site-mobile-actions">
            {!inApp && ready && signedIn && isOperator ? (
              <Link
                href="/dashboard/operator"
                className="site-nav-link is-mobile"
                onClick={() => setMobileOpen(false)}
              >
                <Shield className="site-nav-ico" aria-hidden strokeWidth={2.25} />
                <span className="site-nav-label">{t("nav.operatorDashboard")}</span>
              </Link>
            ) : null}
            {!inApp && ready && !signedIn ? (
              <Link
                href="/signin"
                className="site-nav-link is-mobile"
                onClick={() => setMobileOpen(false)}
              >
                <span className="site-nav-label">{t("nav.signIn")}</span>
              </Link>
            ) : null}
            {ready || inApp ? (
              <Link
                href={primaryHref}
                className="site-nav-link is-mobile is-cta"
                onClick={() => setMobileOpen(false)}
              >
                <PrimaryIcon className="site-nav-ico" aria-hidden strokeWidth={2.25} />
                <span className="site-nav-label">{primaryMobileLabel}</span>
              </Link>
            ) : null}
            <div className="site-mobile-utils">
              <SiteTranslate />
              <ThemeToggle variant="nav" className="site-mobile-theme" />
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
