"use client";

import dynamic from "next/dynamic";
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

// ssr: false must live inside a Client Component — using it in a Server Component
// causes React error #300 (hook count mismatch between SSR and hydration).
const CalendarView = dynamic(
  () => import("./CalendarView").then((m) => m.CalendarView),
  { ssr: false, loading: () => <CalendarSkeleton /> }
);

export function CalendarPageClient({ initialEvents, teamMembers, currentUserId }: Props) {
  return (
    <CalendarView
      initialEvents={initialEvents}
      teamMembers={teamMembers}
      currentUserId={currentUserId}
    />
  );
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 bg-gray-200 rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-16 bg-gray-200 rounded" />
          <div className="h-8 w-24 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="flex-1 bg-white border border-border rounded-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="py-2 flex justify-center">
              <div className="h-4 w-8 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="border-r border-b border-border p-2 min-h-[100px]">
              <div className="h-5 w-5 bg-gray-100 rounded-full mb-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
