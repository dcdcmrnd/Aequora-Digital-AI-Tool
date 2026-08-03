import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { runAutomationsForTrigger } from "@/lib/automation/engine";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  contactIds: z.array(z.string()).min(1).max(1000),
  tags: z.array(z.string().min(1)).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { contactIds } = parsed.data;
  const newTags = Array.from(new Set(parsed.data.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)));
  const contacts = await prisma.contact.findMany({ where: { id: { in: contactIds } } });

  let updated = 0;
  for (const contact of contacts) {
    const existingTags = JSON.parse(contact.tags) as string[];
    const existingLower = new Set(existingTags.map((t) => t.toLowerCase()));
    const toAdd = newTags.filter((tag) => !existingLower.has(tag));
    if (toAdd.length === 0) continue;

    await prisma.contact.update({
      where: { id: contact.id },
      data: { tags: JSON.stringify([...existingTags, ...toAdd]) },
    });
    updated += 1;

    for (const tag of toAdd) {
      await runAutomationsForTrigger({ triggerType: "tag_added", contactId: contact.id, tag });
    }
  }

  return NextResponse.json({ updated });
}
