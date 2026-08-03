import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { sendEmail } from "@/lib/gmail";
import { applyMergeTags, SAMPLE_MERGE_VALUES } from "@/lib/automation/mergeTags";

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

  try {
    await sendEmail({
      to,
      subject: `[TEST] ${applyMergeTags(subject, SAMPLE_MERGE_VALUES)}`,
      body: applyMergeTags(body, SAMPLE_MERGE_VALUES),
      cc: cc ? applyMergeTags(cc, SAMPLE_MERGE_VALUES) : undefined,
      fromEmail,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Gmail not connected")) {
      return NextResponse.json({ error: "No agency Gmail account is connected." }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to send test email." }, { status: 500 });
  }
}
