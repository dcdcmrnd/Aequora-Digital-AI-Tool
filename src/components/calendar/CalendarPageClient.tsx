"use client";

import { CalendarView } from "./CalendarView";
import type { CalendarEvent } from "@/types";

interface TeamMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Props {
  initialEvents: CalendarEvent[];
  teamMembers: TeamMember[];
  currentUserId: string;
}

// Thin client boundary so the server page can pass serialized data to CalendarView.
// No dynamic() needed — CalendarView uses suppressHydrationWarning on date-sensitive
// elements to handle the UTC (server) vs local (client) new Date() difference.
export function CalendarPageClient({ initialEvents, teamMembers, currentUserId }: Props) {
  return (
    <CalendarView
      initialEvents={initialEvents}
      teamMembers={teamMembers}
      currentUserId={currentUserId}
    />
  );
}
