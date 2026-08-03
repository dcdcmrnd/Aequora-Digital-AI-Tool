import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/gmail";
import { checkPermission } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to, subject, body, threadId, inReplyTo, references, fromEmail, scope } = await req.json();

  if (scope !== "own" && scope !== "agency") {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  if (scope === "agency") {
    const canAccessInbox = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
    if (!canAccessInbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownerId = scope === "own" ? session.user.id : null;

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  try {
    const result = await sendEmail({ to, subject, body, threadId, inReplyTo, references, fromEmail }, ownerId);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message?.includes("Gmail not connected")) {
      return NextResponse.json({ error: "not_connected" }, { status: 503 });
    }
    if (err.message?.includes("not accessible")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
