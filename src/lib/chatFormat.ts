/**
 * "2:30 PM" for a message sent today, "Yesterday, 2:30 PM", otherwise a
 * short date ("Mar 5, 2:30 PM", or with the year once it's not this year) --
 * shared by the full chat page and the floating chat-head widget so a
 * message's actual day is always identifiable, not just its time.
 */
export function formatMessageTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (date.toDateString() === now.toDateString()) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;

  const sameYear = date.getFullYear() === now.getFullYear();
  const datePart = date.toLocaleDateString([], sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  return `${datePart}, ${time}`;
}
