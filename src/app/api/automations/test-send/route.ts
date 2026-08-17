import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { sendEmail } from "@/lib/gmail";
import { applyMergeTags, contactMergeValues, customValueMergeValues, SAMPLE_MERGE_VALUES } from "@/lib/automation/mergeTags";
import { prisma } from "@/lib/prisma";
import { escapeLikePattern } from "@/lib/db";

const testSendSchema = z.object({
  to: z.string().email("Enter a valid email address."),
  subject: z.string(),
  body: z.string(),
  cc: z.string().optional(),
  fromEmail: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = testSendSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const { to, subject, body, cc, fromEmail } = parsed.data;

  // If "to" matches a real contact, use their actual info instead of the
  // John Doe placeholder -- this doubles as a genuine one-off send (e.g.
  // testing exactly what a specific contact will see), not just a preview.
  const contact = await prisma.contact.findFirst({
    where: { email: { equals: escapeLikePattern(to), mode: "insensitive" } },
  });
  const mergeValues = {
    ...(contact ? contactMergeValues(contact) : SAMPLE_MERGE_VALUES),
    ...(await customValueMergeValues()),
  };

  try {
    await sendEmail({
      to,
      subject: applyMergeTags(subject, mergeValues),
      body: applyMergeTags(body, mergeValues),
      cc: cc ? applyMergeTags(cc, mergeValues) : undefined,
      fromEmail,
    }, null);
    return NextResponse.json({ success: true, usedContact: !!contact });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Gmail not connected")) {
      return NextResponse.json({ error: "No agency Gmail account is connected." }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to send test email." }, { status: 500 });
  }
}
