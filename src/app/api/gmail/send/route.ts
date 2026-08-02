import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/gmail";
import { checkPermission } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canAccessInbox = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
  if (!canAccessInbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { to, subject, body, threadId, inReplyTo, references, fromEmail } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  try {
    const result = await sendEmail({ to, subject, body, threadId, inReplyTo, references, fromEmail });
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message?.includes("Gmail not connected")) {
      return NextResponse.json({ error: "not_connected" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
