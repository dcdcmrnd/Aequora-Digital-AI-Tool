import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { enrollContactInAutomation } from "@/lib/automation/engine";
import { checkPermission } from "@/lib/permissions";

const schema = z.object({
  contactIds: z.array(z.string()).min(1).max(1000),
  automationId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { contactIds, automationId } = parsed.data;

  let enrolled = 0;
  for (const contactId of contactIds) {
    const ok = await enrollContactInAutomation(automationId, contactId);
    if (ok) enrolled += 1;
  }

  return NextResponse.json({ enrolled, skipped: contactIds.length - enrolled });
}
