import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { runAutomationsForTrigger } from "@/lib/automation/engine";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const importRowSchema = z.object({
  name: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

const importSchema = z.object({ contacts: z.array(importRowSchema).min(1).max(2000) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid import." }, { status: 400 });
  }

  const rows = parsed.data.contacts;
  const existingEmails = new Set(
    (await prisma.contact.findMany({ where: { email: { not: null } }, select: { email: true } }))
      .map((c) => c.email!.toLowerCase()),
  );
  const seenInBatch = new Set<string>();

  let created = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const emailKey = row.email?.trim().toLowerCase();

    if (emailKey) {
      if (existingEmails.has(emailKey) || seenInBatch.has(emailKey)) {
        skipped.push({ row: i + 1, reason: `Duplicate email: ${row.email}` });
        continue;
      }
      seenInBatch.add(emailKey);
    }

    const contact = await prisma.contact.create({
      data: {
        name: row.name.trim(),
        firstName: row.firstName?.trim() || undefined,
        lastName: row.lastName?.trim() || undefined,
        email: row.email?.trim() || undefined,
        phone: row.phone?.trim() || undefined,
        company: row.company?.trim() || undefined,
        website: row.website?.trim() || undefined,
        notes: row.notes?.trim() || undefined,
        tags: "[]",
        createdById: session.user.id,
      },
    });
    created += 1;

    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "contact",
      entityId: contact.id,
      entityName: contact.name,
    });
    await runAutomationsForTrigger({ triggerType: "contact_created", contactId: contact.id });
  }

  return NextResponse.json({ created, skipped });
}
