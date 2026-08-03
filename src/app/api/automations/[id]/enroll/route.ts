import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { enrollContactInAutomation } from "@/lib/automation/engine";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().email("Enter a valid email address.") });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const email = parsed.data.email.trim();

  let contact = await prisma.contact.findFirst({ where: { email } });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { name: email, email, tags: "[]", createdById: session.user.id },
    });
  }

  const enrolled = await enrollContactInAutomation(params.id, contact.id);
  if (!enrolled) {
    return NextResponse.json(
      { error: "Couldn't add this contact — it may already be running in this workflow, or the trigger has no action attached yet." },
      { status: 400 },
    );
  }

  return NextResponse.json({ enrolled: true, contactId: contact.id });
}
