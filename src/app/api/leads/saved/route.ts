import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LEAD_STATUS_VALUES = ["New", "Contacted", "Meeting Scheduled", "Proposal Sent", "Won", "Lost"] as const;

const saveSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  followUpDate: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const savedLeads = await prisma.savedLead.findMany({
    where: { userId: session.user.id },
    include: { lead: { include: { audit: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    savedLeads: savedLeads.map((saved) => ({ ...saved, tags: JSON.parse(saved.tags) })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A lead is required." }, { status: 400 });
  }

  // Check-then-insert rather than upsert: re-saving an already-saved lead
  // must be a no-op, not reset its status/tags/follow-up date back to
  // fresh-save defaults.
  const existing = await prisma.savedLead.findUnique({
    where: { userId_leadId: { userId: session.user.id, leadId: parsed.data.leadId } },
    include: { lead: { include: { audit: true } } },
  });

  if (existing) {
    return NextResponse.json({ savedLead: { ...existing, tags: JSON.parse(existing.tags) } });
  }

  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const created = await prisma.savedLead.create({
    data: {
      userId: session.user.id,
      leadId: parsed.data.leadId,
      status: parsed.data.status ?? "New",
      notes: parsed.data.notes,
      tags: JSON.stringify(parsed.data.tags ?? []),
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
    },
    include: { lead: { include: { audit: true } } },
  });

  await logActivity({
    userId: session.user.id,
    action: "created",
    entityType: "lead",
    entityId: lead.id,
    entityName: lead.name,
    metadata: { action: "saved" },
  });

  return NextResponse.json({ savedLead: { ...created, tags: JSON.parse(created.tags) } }, { status: 201 });
}
