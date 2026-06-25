import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { CalendarEvent, CalendarEventType } from "@/types";
import { CalendarPageClient } from "@/components/calendar/CalendarPageClient";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let serialized: CalendarEvent[] = [];
  let teamMembers: { id: string; name: string; avatarUrl: string | null }[] = [];

  try {
    const [events, members] = await Promise.all([
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

    serialized = events.map((ev) => ({
      ...ev,
      type: ev.type as CalendarEventType,
      startDate: ev.startDate.toISOString(),
      endDate: ev.endDate.toISOString(),
      createdAt: ev.createdAt.toISOString(),
      updatedAt: ev.updatedAt.toISOString(),
    }));
    teamMembers = members;
  } catch (err) {
    // CalendarEvent table may not exist yet — render empty calendar rather than
    // letting the error propagate through the RSC stream as React error #300.
    console.error("[CalendarPage] DB error:", err);
  }

  return (
    <CalendarPageClient
      initialEvents={serialized}
      teamMembers={teamMembers}
      currentUserId={session.user.id}
    />
  );
}
