import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EVENT_INCLUDE = {
  createdBy: { select: { id: true, name: true, avatarUrl: true } },
  attendees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  task: { select: { id: true, title: true, status: true } },
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = event.createdById === session.user.id;
  const isAdmin = session.user.role === "admin";
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, description, type, startDate, endDate, allDay, location, color, taskId, attendeeIds } = body;

  // Replace attendees if provided
  if (attendeeIds !== undefined) {
    await prisma.eventAttendee.deleteMany({ where: { eventId: params.id } });
    await prisma.eventAttendee.createMany({
      data: [
        { eventId: params.id, userId: event.createdById },
        ...attendeeIds
          .filter((id: string) => id !== event.createdById)
          .map((id: string) => ({ eventId: params.id, userId: id })),
      ],
      skipDuplicates: true,
    });
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(type !== undefined && { type }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: new Date(endDate) }),
      ...(allDay !== undefined && { allDay }),
      ...(location !== undefined && { location: location?.trim() || null }),
      ...(color !== undefined && { color: color || null }),
      ...(taskId !== undefined && { taskId: taskId || null }),
    },
    include: EVENT_INCLUDE,
  });

  return NextResponse.json({ event: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = event.createdById === session.user.id;
  const isAdmin = session.user.role === "admin";
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.calendarEvent.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
