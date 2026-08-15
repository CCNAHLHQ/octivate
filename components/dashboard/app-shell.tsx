"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import {
  LayoutDashboard,
  FileText,
  Rss,
  Users,
  FolderKanban,
  Menu,
  X,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  FileOutput,
  Shield,
  ChevronLeft,
  ChevronRight,
  Bug,
  LifeBuoy,
  DollarSign,
  Database,
  Mail,
  Store,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OctivateLogo } from "@/components/brand";
import { WorkspaceTutorialButton } from "@/components/onboarding/workspace-tutorial-button";
import { WorkspaceIntroModal } from "@/components/onboarding/workspace-intro-modal";
import { OperatorIntroModal } from "@/components/onboarding/operator-intro-modal";
import { SidebarAccountCard } from "@/components/dashboard/sidebar-account";
import { SessionGuard } from "@/components/auth/session-guard";
import { OperatorSupportAlerts } from "@/components/operator/operator-support-alerts";
import { useT } from "@/components/i18n/locale-provider";
import { WORKSPACE_TOUR_SIDEBAR_EVENT } from "@/lib/onboarding/content";
import { setLocationHash } from "@/lib/navigation/hash";
import type { PublicUser } from "@/lib/auth/types";
import type { MessageKey } from "@/lib/i18n/messages";

interface AppShellProps {
  children: React.ReactNode;
  variant?: "user" | "operator";
}

const SIDEBAR_STORAGE_KEY = "octivate-sidebar-collapsed";

const userNav = [
  {
    sectionKey: "ws.section.workspace" as MessageKey,
    items: [
      { labelKey: "ws.nav.overview" as MessageKey, href: "/dashboard", icon: LayoutDashboard },
      { labelKey: "ws.nav.projects" as MessageKey, href: "/dashboard/projects", icon: FolderKanban },
      { labelKey: "ws.nav.sources" as MessageKey, href: "/dashboard/sources", icon: Rss },
    ],
  },
  {
    sectionKey: "ws.section.intelligence" as MessageKey,
    items: [{ labelKey: "ws.nav.briefs" as MessageKey, href: "/dashboard/briefs", icon: FileText }],
  },
  {
    sectionKey: "ws.section.analysis" as MessageKey,
    items: [
      { labelKey: "ws.nav.stakeholders" as MessageKey, href: "/dashboard/stakeholders", icon: Users },
    ],
  },
];

const operatorNav = [
  {
    sectionKey: "op.section.production" as MessageKey,
    items: [
      { labelKey: "op.tab.pulse" as MessageKey, href: "/dashboard/operator#pulse", icon: Shield },
      {
        labelKey: "op.tab.operations" as MessageKey,
        href: "/dashboard/operator#operations",
        icon: Trash2,
      },
      {
        labelKey: "op.tab.control" as MessageKey,
        href: "/dashboard/operator#control",
        icon: SlidersHorizontal,
      },
      { labelKey: "op.tab.catalog" as MessageKey, href: "/dashboard/operator#catalog", icon: Database },
      {
        labelKey: "op.tab.support" as MessageKey,
        href: "/dashboard/operator#support",
        icon: LifeBuoy,
      },
      { labelKey: "op.tab.mail" as MessageKey, href: "/dashboard/operator#mail", icon: Mail },
      { labelKey: "op.tab.users" as MessageKey, href: "/dashboard/operator#users", icon: Users },
      {
        labelKey: "op.tab.pricing" as MessageKey,
        href: "/dashboard/operator#pricing",
        icon: DollarSign,
      },
      {
        labelKey: "op.tab.merchants" as MessageKey,
        href: "/dashboard/operator#merchants",
        icon: Store,
      },
      {
        labelKey: "op.tab.automation" as MessageKey,
        href: "/dashboard/operator#automation",
        icon: Bot,
      },
      {
        labelKey: "op.tab.exports" as MessageKey,
        href: "/dashboard/operator#exports",
        icon: FileOutput,
      },
      { labelKey: "op.tab.debug" as MessageKey, href: "/dashboard/operator#debug", icon: Bug },
    ],
  },
];

function pathActive(pathname: string, href: string, hash: string) {
  const operatorBase = "/dashboard/operator";

  if (href.includes("#")) {
    const [base, frag] = href.split("#");
    if (pathname !== base) return false;
    const h = hash || "#pulse";
    if (frag === "operations") {
      return ["#operations", "#ledger", "#sessions", "#moderation"].includes(h);
    }
    if (frag === "control") {
      return ["#control", "#limits", "#health", "#models"].includes(h);
    }
    if (frag === "pulse") {
      return h === "#pulse" || h === "#overview" || h === "#" || hash === "";
    }
    if (frag === "catalog") {
      return ["#catalog", "#ticker", "#sources"].includes(h);
    }
    return h === `#${frag}`;
  }

  if (href === operatorBase) {
    return (
      pathname === operatorBase &&
      (hash === "" || hash === "#" || hash === "#overview" || hash === "#pulse")
    );
  }
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function AppShell({ children, variant = "user" }: AppShellProps) {
  const t = useT();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [hash, setHash] = useState("");
  const [sessionUser, setSessionUser] = useState<PublicUser | null>(null);
  const pathname = usePathname();
  const nav = variant === "operator" ? operatorNav : userNav;
  const isOperatorRoute = pathname.startsWith("/dashboard/operator");
  const desktopExpanded = !desktopCollapsed;
  const isOperatorUser = sessionUser?.role === "operator";

  useEffect(() => {
    document.documentElement.classList.add("octivate-dashboard");
    return () => document.documentElement.classList.remove("octivate-dashboard");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data: { user?: PublicUser | null }) => {
        if (!cancelled) setSessionUser(data.user || null);
      })
      .catch(() => {
        if (!cancelled) setSessionUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    try {
      setDesktopCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const sync = () => setHash(window.location.hash || "");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    if (mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const onTourSidebar = () => {
      openDesktopSidebar();
      setSidebarOpen(true);
    };
    window.addEventListener(WORKSPACE_TOUR_SIDEBAR_EVENT, onTourSidebar);
    return () => window.removeEventListener(WORKSPACE_TOUR_SIDEBAR_EVENT, onTourSidebar);
  }, []);

  function openDesktopSidebar() {
    setDesktopCollapsed(false);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, "0");
    } catch {
      /* ignore */
    }
  }

  function closeDesktopSidebar() {
    setDesktopCollapsed(true);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function toggleDesktopSidebar() {
    if (desktopCollapsed) openDesktopSidebar();
    else closeDesktopSidebar();
  }

  /** Same-page hash Links update the URL bar without firing hashchange — sync manually. */
  function onNavClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    setSidebarOpen(false);
    if (!href.includes("#")) return;
    const [base, frag] = href.split("#");
    if (!frag || pathname !== base) return;
    e.preventDefault();
    setLocationHash(frag);
    setHash(`#${frag}`);
  }

  return (
    <div
      className={cn(
        "dash-shell",
        desktopExpanded && "dash-shell-sidebar-open",
        (variant === "operator" || isOperatorRoute) && "is-operator"
      )}
      data-variant={variant === "operator" || isOperatorRoute ? "operator" : "user"}
      data-mobile-open={sidebarOpen ? "true" : "false"}
    >
      <div
        className="dash-mobile-backdrop"
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />

      <button
        type="button"
        className="dash-sidebar-toggle"
        onClick={toggleDesktopSidebar}
        aria-label={desktopExpanded ? t("ws.collapseSidebar") : t("ws.expandSidebar")}
        aria-expanded={desktopExpanded}
      >
        {desktopExpanded ? (
          <ChevronLeft className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden />
        )}
      </button>

      <aside className="dash-aside" aria-label="Workspace navigation">
        <div className="dash-aside-inner">
          <div className="dash-aside-head">
            <Link href="/" className="dash-aside-brand">
              <OctivateLogo
                variant="lockup"
                height={34}
                sub={isOperatorRoute ? "Operator" : undefined}
              />
            </Link>
            <button
              type="button"
              className="dash-aside-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!isOperatorRoute ? (
            <div className="dash-cta-stack">
              <Link
                href="/dashboard/projects"
                data-tour="ask-strategic"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="btn btn-primary btn-sm">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {t("ws.askStrategic")}
                </span>
              </Link>
              {isOperatorUser ? (
                <Link
                  href="/dashboard/operator#pulse"
                  onClick={(e) => onNavClick(e, "/dashboard/operator#pulse")}
                >
                  <span className="btn btn-ghost btn-sm dash-op-dash-btn">
                    <Shield className="h-3.5 w-3.5" aria-hidden />
                    {t("ws.operatorDashboard")}
                  </span>
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="dash-cta-stack">
              <Link href="/dashboard" onClick={() => setSidebarOpen(false)}>
                <span className="btn btn-primary btn-sm">
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                  {t("ws.mode.workspace")}
                </span>
              </Link>
            </div>
          )}

          <nav className="dash-aside-nav" aria-label="Primary">
            {nav.map((section) => (
              <div key={section.sectionKey} className="dash-aside-section">
                <div className="dash-aside-section-label">{t(section.sectionKey)}</div>
                <div className="dash-aside-section-items">
                  {section.items.map((item) => {
                    const active =
                      variant === "operator" || isOperatorRoute
                        ? pathActive(pathname, item.href, hash)
                        : pathname === item.href ||
                          (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        data-tour={
                          item.href === "/dashboard"
                            ? "nav-overview"
                            : item.href === "/dashboard/projects"
                              ? "nav-projects"
                              : item.href === "/dashboard/briefs"
                                ? "nav-briefs"
                                : undefined
                        }
                        onClick={(e) => onNavClick(e, item.href)}
                        className={cn(
                          "dash-nav-link",
                          active
                            ? "dash-link-active"
                            : "text-mist hover:bg-white/[0.04] hover:text-foam"
                        )}
                      >
                        <Icon aria-hidden />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="dash-aside-foot">
            <SidebarAccountCard onNavigate={() => setSidebarOpen(false)} />
            {/* Headless: keep operator support SSE armed without sidebar chrome icons. */}
            {isOperatorUser ? <OperatorSupportAlerts /> : null}
            <nav className="dash-legal-links" data-tour="legal-notice" aria-label="Legal">
              <Link
                href="/privacy"
                className="dash-legal-link"
                onClick={() => setSidebarOpen(false)}
              >
                {t("footer.privacy")}
              </Link>
              <span className="dash-legal-sep" aria-hidden>
                ·
              </span>
              <Link
                href="/terms"
                className="dash-legal-link"
                onClick={() => setSidebarOpen(false)}
              >
                {t("footer.terms")}
              </Link>
            </nav>
            {isOperatorRoute || variant === "operator" ? (
              <WorkspaceTutorialButton
                variant="sidebar"
                mode="operator"
                label={t("op.tour.replay")}
              />
            ) : (
              <WorkspaceTutorialButton
                variant="sidebar"
                mode="workspace"
                label={t("onboard.ui.replayWorkspace")}
              />
            )}
          </div>
        </div>
      </aside>

      <div className="dash-main">
        <div className="dash-mobile-bar">
          <button
            type="button"
            className="rounded-[10px] border border-[rgba(154,171,255,0.14)] p-2 text-mist"
            onClick={() => setSidebarOpen(true)}
            aria-label={t("ws.openMenu")}
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            Workspace menu
          </span>
          {isOperatorRoute || variant === "operator" ? (
            <WorkspaceTutorialButton
              variant="inline"
              mode="operator"
              className="ml-auto"
              label={t("op.tour.label")}
            />
          ) : (
            <WorkspaceTutorialButton variant="inline" mode="workspace" className="ml-auto" />
          )}
        </div>

        {children}

        {isOperatorRoute || variant === "operator" ? (
          <WorkspaceTutorialButton variant="fab" mode="operator" />
        ) : (
          <WorkspaceTutorialButton variant="fab" mode="workspace" />
        )}
        <SessionGuard />
      </div>

      {isOperatorRoute || variant === "operator" ? (
        <OperatorIntroModal />
      ) : (
        <WorkspaceIntroModal />
      )}
    </div>
  );
}
