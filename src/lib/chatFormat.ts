import { DISPLAY_TIMEZONE } from "@/lib/utils";

/** Y/M/D of `date` as seen in `timeZone`, for comparing calendar days across timezones without shifting the underlying instant. */
function dateKeyInTimeZone(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone }); // en-CA gives YYYY-MM-DD, a directly comparable string
}

/**
 * "2:30 PM" for a message sent today, "Yesterday, 2:30 PM", otherwise a
 * short date ("Mar 5, 2:30 PM", or with the year once it's not this year) --
 * shared by the full chat page and the floating chat-head widget so a
 * message's actual day is always identifiable, not just its time. Both the
 * displayed clock time and the today/yesterday comparison are anchored to
 * DISPLAY_TIMEZONE, not the viewer's own device timezone, so the label and
 * the day boundary it's judged against never disagree with each other.
 */
export function formatMessageTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: DISPLAY_TIMEZONE });

  const todayKey = dateKeyInTimeZone(now, DISPLAY_TIMEZONE);
  const dateKey = dateKeyInTimeZone(date, DISPLAY_TIMEZONE);
  if (dateKey === todayKey) return time;

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (dateKey === dateKeyInTimeZone(yesterday, DISPLAY_TIMEZONE)) return `Yesterday, ${time}`;

  const sameYear = dateKey.slice(0, 4) === todayKey.slice(0, 4);
  const datePart = date.toLocaleDateString(
    [],
    sameYear
      ? { month: "short", day: "numeric", timeZone: DISPLAY_TIMEZONE }
      : { month: "short", day: "numeric", year: "numeric", timeZone: DISPLAY_TIMEZONE },
  );
  return `${datePart}, ${time}`;
}
