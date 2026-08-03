import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  contactIds: z.array(z.string()).min(1).max(1000),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "pipeline.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { contactIds, pipelineId, stageId } = parsed.data;
  const contacts = await prisma.contact.findMany({ where: { id: { in: contactIds } } });

  let created = 0;
  for (const contact of contacts) {
    await prisma.opportunity.create({
      data: {
        name: contact.name,
        contactId: contact.id,
        pipelineId,
        stageId,
        createdById: session.user.id,
      },
    });
    created += 1;
  }

  return NextResponse.json({ created });
}
