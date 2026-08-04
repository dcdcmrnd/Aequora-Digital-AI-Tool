import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Common US timezones for the "wait until" scheduler — covers the continental US plus Alaska/Hawaii. */
export const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time - no DST (Arizona)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "UTC", label: "UTC" },
] as const;

export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/**
 * The next UTC instant at which it is `hour:minute` on `dayOfWeek` (0=Sunday
 * ... 6=Saturday) in `timeZone`. All date arithmetic here is done on
 * UTC-anchored date-only strings so the result never depends on the
 * runtime's own system timezone — only the final conversion is
 * timezone-aware (and DST-correct for that specific target date).
 */
export function getNextWeekdayOccurrenceUtc(
  dayOfWeek: number,
  hour: number,
  minute: number,
  timeZone: string,
  from: Date = new Date(),
): Date {
  const todayStr = formatInTimeZone(from, timeZone, "yyyy-MM-dd");
  const todayDow = new Date(`${todayStr}T00:00:00Z`).getUTCDay();

  const daysUntil = (dayOfWeek - todayDow + 7) % 7;
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");

  const candidateOnly = new Date(`${todayStr}T00:00:00Z`);
  candidateOnly.setUTCDate(candidateOnly.getUTCDate() + daysUntil);
  let target = fromZonedTime(`${candidateOnly.toISOString().slice(0, 10)}T${hh}:${mm}:00`, timeZone);

  // Either today's time already passed, or (defensively) the computed
  // instant is otherwise not in the future — push out exactly one week.
  if (target.getTime() <= from.getTime()) {
    const pushedOnly = new Date(candidateOnly);
    pushedOnly.setUTCDate(pushedOnly.getUTCDate() + 7);
    target = fromZonedTime(`${pushedOnly.toISOString().slice(0, 10)}T${hh}:${mm}:00`, timeZone);
  }

  return target;
}

export function formatWeekdayTime(dayOfWeek: number, hour: number, minute: number, timeZone: string): string {
  const day = WEEKDAY_LABELS[dayOfWeek] ?? "";
  const hh = String(hour % 12 === 0 ? 12 : hour % 12);
  const mm = String(minute).padStart(2, "0");
  const ampm = hour < 12 ? "AM" : "PM";
  const tzLabel = COMMON_TIMEZONES.find((t) => t.value === timeZone)?.label ?? timeZone;
  return `${day}s at ${hh}:${mm} ${ampm} (${tzLabel})`;
}
