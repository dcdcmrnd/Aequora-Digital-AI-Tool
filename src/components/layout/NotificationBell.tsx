"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { Notification } from "@/types";

const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  task: (id) => `/projects`, // navigate to projects; task panels open via project page
  project: (id) => `/projects/${id}`,
  note: (id) => `/notes/${id}`,
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleClick = async (n: Notification) => {
    if (!n.isRead) await markRead(n.id);
    setOpen(false);
    const route = ENTITY_ROUTES[n.entityType]?.(n.entityId);
    if (route) router.push(route);
  };

  const getIcon = (type: string) => {
    if (type === "task_assigned") return "✓";
    if (type === "task_completed") return "✅";
    if (type === "mention") return "@";
    return "🔔";
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-btn transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white border border-border rounded-card shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-danger text-white font-medium px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-text-muted">No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-secondary transition-colors",
                    !n.isRead && "bg-blue-50/60"
                  )}
                >
                  <span className="text-base flex-shrink-0 mt-0.5">{getIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm text-text-primary leading-snug", !n.isRead && "font-medium")}>
                      {n.title}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-text-muted mt-1">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
