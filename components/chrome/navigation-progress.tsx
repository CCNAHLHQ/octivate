"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Always mounts the same DOM (empty track) so it never shifts siblings during hydration.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active && width === 0) return;
    setWidth(100);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 240);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("http"))
        return;
      if (href.startsWith("/") && href.split("?")[0] !== pathname) {
        setActive(true);
        setWidth(18);
        requestAnimationFrame(() => setWidth(68));
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  return (
    <div
      className="nav-progress"
      role="progressbar"
      aria-hidden={!active}
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
      data-active={active ? "true" : "false"}
    >
      <div className="nav-progress-bar" style={{ width: `${width}%` }} />
    </div>
  );
}
