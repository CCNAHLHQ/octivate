"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  LifeBuoy,
  Trash2,
  X,
} from "lucide-react";
import { OperatorSupportAlerts } from "@/components/operator/operator-support-alerts";
import { Tooltip } from "@/components/ui/tooltip";
import type { PublicUser } from "@/lib/auth/types";
import {
  clearOperatorNotifications,
  countUnreadNotifications,
  formatNotificationWhen,
  markAllOperatorNotificationsRead,
  markOperatorNotificationRead,
  openOperatorSupportThread,
  readOperatorNotifications,
  removeOperatorNotification,
  subscribeOperatorNotifications,
  type OperatorNotification,
} from "@/lib/operator/notifications";
import { cn } from "@/lib/utils";

/**
 * Global chrome alerts control — sits after the lighting (theme) toggle.
 * Operator-only; theme surfaces match site-translate / theme-toggle.
 */
export function SiteAlerts({ className }: { className?: string }) {
  const [user, setUser] = useState<PublicUser | null | undefined>(undefined);
  const [items, setItems] = useState<OperatorNotification[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
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

  useEffect(() => {
    setItems(readOperatorNotifications());
    return subscribeOperatorNotifications(setItems);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isOperator = user?.role === "operator";
  const unread = useMemo(() => countUnreadNotifications(items), [items]);

  if (user === undefined || !isOperator) return null;

  function openThread(n: OperatorNotification) {
    markOperatorNotificationRead(n.id);
    openOperatorSupportThread(n.threadId);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("site-alerts", className)}>
      <OperatorSupportAlerts />
      <Tooltip
        content={
          unread > 0
            ? `${unread} unread support alert${unread === 1 ? "" : "s"}`
            : "Support alerts"
        }
        side="bottom"
      >
        <button
          type="button"
          className={cn(
            "site-alerts-btn",
            open && "is-open",
            unread > 0 && "has-unread"
          )}
          aria-label={
            unread > 0 ? `Support alerts, ${unread} unread` : "Support alerts"
          }
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Support alerts"
          onClick={() => setOpen((v) => !v)}
        >
          <Bell className="site-alerts-ico" aria-hidden strokeWidth={2.1} />
          {unread > 0 ? (
            <span className="site-alerts-badge" aria-hidden>
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </Tooltip>

      {open ? (
        <div className="site-alerts-menu" role="dialog" aria-label="Support alerts">
          <div className="site-alerts-menu-head">
            <p className="site-alerts-menu-title">
              Alerts
              {unread > 0 ? (
                <span className="site-alerts-menu-count">{unread} new</span>
              ) : null}
            </p>
            <div className="site-alerts-menu-actions">
              <Tooltip content="Mark all as read" side="bottom">
                <button
                  type="button"
                  className="site-alerts-icon-btn"
                  aria-label="Mark all as read"
                  disabled={unread === 0}
                  onClick={() => markAllOperatorNotificationsRead()}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
              <Tooltip content="Clear alert history" side="bottom">
                <button
                  type="button"
                  className="site-alerts-icon-btn"
                  aria-label="Clear all alerts"
                  disabled={items.length === 0}
                  onClick={() => clearOperatorNotifications()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
              <Tooltip content="Close" side="bottom">
                <button
                  type="button"
                  className="site-alerts-icon-btn"
                  aria-label="Close alerts"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="site-alerts-list">
            {items.length === 0 ? (
              <p className="site-alerts-empty">No recent support alerts.</p>
            ) : (
              items.map((n) => (
                <article
                  key={n.id}
                  className={cn("site-alerts-item", !n.read && "is-unread")}
                >
                  <button
                    type="button"
                    className="site-alerts-item-main"
                    onClick={() => openThread(n)}
                  >
                    <span className="site-alerts-item-ico" aria-hidden>
                      <LifeBuoy className="h-3.5 w-3.5" />
                    </span>
                    <span className="site-alerts-item-copy">
                      <span className="site-alerts-item-title">{n.title}</span>
                      <span className="site-alerts-item-body">{n.body}</span>
                      <span className="site-alerts-item-when">
                        {formatNotificationWhen(n.at)}
                      </span>
                    </span>
                  </button>
                  <div className="site-alerts-item-tools">
                    {!n.read ? (
                      <Tooltip content="Mark as read" side="top">
                        <button
                          type="button"
                          className="site-alerts-icon-btn"
                          aria-label="Mark as read"
                          onClick={() => markOperatorNotificationRead(n.id)}
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    ) : null}
                    <Tooltip content="Open conversation" side="top">
                      <button
                        type="button"
                        className="site-alerts-icon-btn"
                        aria-label="Open chat"
                        onClick={() => openThread(n)}
                      >
                        <LifeBuoy className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Dismiss" side="top">
                      <button
                        type="button"
                        className="site-alerts-icon-btn"
                        aria-label="Dismiss alert"
                        onClick={() => removeOperatorNotification(n.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </article>
              ))
            )}
          </div>

          {items.length > 0 ? (
            <div className="site-alerts-menu-foot">
              <Tooltip content="Mark every alert as read" side="top">
                <button
                  type="button"
                  className="site-alerts-read-all"
                  disabled={unread === 0}
                  onClick={() => markAllOperatorNotificationsRead()}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Read all
                </button>
              </Tooltip>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
