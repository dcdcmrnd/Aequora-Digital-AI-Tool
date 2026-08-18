import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// The whole app displays dates/times in Philippine time regardless of the
// viewer's own device/browser timezone, so everyone sees the same clock
// rather than whatever timezone happens to be set locally.
export const DISPLAY_TIMEZONE = "Asia/Manila";

export function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: DISPLAY_TIMEZONE });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

export function getGreeting(): string {
  // Hour-of-day in DISPLAY_TIMEZONE, not the runtime's own timezone -- this
  // renders server-side, where the server's local time is UTC (Vercel),
  // which would otherwise call the middle of the PH afternoon "evening."
  const hour =
    Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: DISPLAY_TIMEZONE }).format(new Date())) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function isOverdue(date: Date | string | null): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  return d < new Date() && d.toDateString() !== new Date().toDateString();
}

export function isDueToday(date: Date | string | null): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toDateString() === new Date().toDateString();
}

export function isDueThisWeek(date: Date | string | null): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return d > now && d <= weekEnd;
}
