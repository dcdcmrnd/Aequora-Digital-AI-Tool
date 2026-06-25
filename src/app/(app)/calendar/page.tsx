import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import dynamic from "next/dynamic";

// Disable SSR — the calendar grid uses new Date() for local timezone rendering.
// SSR would produce UTC-based dates that mismatch the browser's local dates.
const CalendarView = dynamic(
  () => import("@/components/calendar/CalendarView").then((m) => m.CalendarView),
  { ssr: false, loading: () => <CalendarSkeleton /> }
);

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [events, teamMembers] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { startDate: { gte: start, lt: end } },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        attendees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        task: { select: { id: true, title: true, status: true } },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "active" },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = events.map((ev) => ({
    ...ev,
    startDate: ev.startDate.toISOString(),
    endDate: ev.endDate.toISOString(),
    createdAt: ev.createdAt.toISOString(),
    updatedAt: ev.updatedAt.toISOString(),
  }));

  return (
    <CalendarView
      initialEvents={serialized}
      teamMembers={teamMembers}
      currentUserId={session.user.id}
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
