import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CalendarView } from "@/components/calendar/CalendarView";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Load current-month events and team members server-side
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
