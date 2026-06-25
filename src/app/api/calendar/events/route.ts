import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EVENT_INCLUDE = {
  createdBy: { select: { id: true, name: true, avatarUrl: true } },
  attendees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  task: { select: { id: true, title: true, status: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM

  let where = {};
  if (month) {
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);
    where = { startDate: { gte: start, lt: end } };
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: EVENT_INCLUDE,
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, type = "event", startDate, endDate, allDay = false, location, color, taskId, attendeeIds = [] } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!startDate || !endDate) return NextResponse.json({ error: "Start and end dates are required." }, { status: 400 });

  const event = await prisma.calendarEvent.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      allDay,
      location: location?.trim() || null,
      color: color || null,
      taskId: taskId || null,
      createdById: session.user.id,
      attendees: {
        create: [
          { userId: session.user.id },
          ...attendeeIds
            .filter((id: string) => id !== session.user.id)
            .map((id: string) => ({ userId: id })),
        ],
      },
    },
    include: EVENT_INCLUDE,
  });

  return NextResponse.json({ event }, { status: 201 });
}
