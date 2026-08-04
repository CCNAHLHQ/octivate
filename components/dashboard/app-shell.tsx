"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import {
  LayoutDashboard,
  FileText,
  Activity,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OctivateLogo } from "@/components/brand";
import { WorkspaceTutorialButton } from "@/components/onboarding/workspace-tutorial-button";
import { WorkspaceIntroModal } from "@/components/onboarding/workspace-intro-modal";
import { OperatorIntroModal } from "@/components/onboarding/operator-intro-modal";
import { SidebarAccountCard } from "@/components/dashboard/sidebar-account";
import { SupportWidget } from "@/components/support/support-widget";
import { SessionGuard } from "@/components/auth/session-guard";
import { WORKSPACE_TOUR_SIDEBAR_EVENT } from "@/lib/onboarding/content";
import { setLocationHash } from "@/lib/navigation/hash";
import type { PublicUser } from "@/lib/auth/types";

/** Account-based support chat for signed-in members (operators use the inbox). */
function MemberSupportChat() {
  const [user, setUser] = useState<PublicUser | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { user?: PublicUser | null }) => {
        if (!cancelled) setUser(data.user || null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!user || user.role === "operator") return null;
  return <SupportWidget user={user} />;
}

interface AppShellProps {
  children: React.ReactNode;
  variant?: "user" | "operator";
}

const SIDEBAR_STORAGE_KEY = "octivate-sidebar-collapsed";

const userNav = [
  {
    section: "Workspace",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
      { label: "Monitors", href: "/dashboard/monitors", icon: Activity },
      { label: "Sources", href: "/dashboard/sources", icon: Rss },
    ],
  },
  {
    section: "Intelligence",
    items: [{ label: "Briefs", href: "/dashboard/briefs", icon: FileText }],
  },
  {
    section: "Analysis",
    items: [{ label: "Stakeholders", href: "/dashboard/stakeholders", icon: Users }],
  },
];

const operatorNav = [
  {
    section: "Production",
    items: [
      { label: "Pulse", href: "/dashboard/operator#pulse", icon: Shield },
      { label: "Operations", href: "/dashboard/operator#operations", icon: Trash2 },
      { label: "Control", href: "/dashboard/operator#control", icon: SlidersHorizontal },
      { label: "Catalog", href: "/dashboard/operator#catalog", icon: Database },
      { label: "Customer Support", href: "/dashboard/operator#support", icon: LifeBuoy },
      { label: "Mail", href: "/dashboard/operator#mail", icon: Mail },
      { label: "Users", href: "/dashboard/operator#users", icon: Users },
      { label: "Pricing", href: "/dashboard/operator#pricing", icon: DollarSign },
      { label: "Exports", href: "/dashboard/operator#exports", icon: FileOutput },
      { label: "Debug", href: "/dashboard/operator#debug", icon: Bug },
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
        aria-label={desktopExpanded ? "Collapse sidebar" : "Expand sidebar"}
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
                  Ask strategic question
                </span>
              </Link>
              {isOperatorUser ? (
                <Link
                  href="/dashboard/operator#pulse"
                  onClick={(e) => onNavClick(e, "/dashboard/operator#pulse")}
                >
                  <span className="btn btn-ghost btn-sm dash-op-dash-btn">
                    <Shield className="h-3.5 w-3.5" aria-hidden />
                    Operator dashboard
                  </span>
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="dash-cta-stack">
              <Link href="/dashboard" onClick={() => setSidebarOpen(false)}>
                <span className="btn btn-primary btn-sm">
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                  Workspace mode
                </span>
              </Link>
            </div>
          )}

          <nav className="dash-aside-nav" aria-label="Primary">
            {nav.map((section) => (
              <div key={section.section} className="dash-aside-section">
                <div className="dash-aside-section-label">{section.section}</div>
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
                            : item.href === "/dashboard/monitors"
                              ? "nav-monitors"
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
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="dash-aside-foot">
            <SidebarAccountCard onNavigate={() => setSidebarOpen(false)} />
            {isOperatorRoute || variant === "operator" ? (
              <WorkspaceTutorialButton
                variant="sidebar"
                mode="operator"
                label="Replay operator tour"
              />
            ) : (
              <WorkspaceTutorialButton
                variant="sidebar"
                mode="workspace"
                label="Replay workspace tour"
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
            aria-label="Open sidebar"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            Workspace menu
          </span>
          {isOperatorRoute || variant === "operator" ? (
            <WorkspaceTutorialButton variant="inline" mode="operator" className="ml-auto" label="Tour" />
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
        {!isOperatorRoute ? <MemberSupportChat /> : null}
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
