import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClient, getHeader, extractBody } from "@/lib/gmail";
import { checkPermission } from "@/lib/permissions";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scopeParam = new URL(req.url).searchParams.get("scope");
  if (scopeParam !== "own" && scopeParam !== "agency") {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  if (scopeParam === "agency") {
    const canAccessInbox = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
    if (!canAccessInbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownerId = scopeParam === "own" ? session.user.id : null;

  try {
    const gmail = await getGmailClient(ownerId);

    const msg = await gmail.users.messages.get({
      userId: "me",
      id: params.id,
      format: "full",
    });

    const headers = msg.data.payload?.headers ?? [];
    const { html, text } = extractBody(msg.data.payload);

    // Mark as read
    if (msg.data.labelIds?.includes("UNREAD")) {
      await gmail.users.messages.modify({
        userId: "me",
        id: params.id,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });
    }

    return NextResponse.json({
      id: msg.data.id,
      threadId: msg.data.threadId,
      snippet: msg.data.snippet,
      labelIds: msg.data.labelIds,
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      subject: getHeader(headers, "Subject"),
      date: getHeader(headers, "Date"),
      replyTo: getHeader(headers, "Reply-To"),
      html,
      text,
    });
  } catch (err: any) {
    if (err.message?.includes("Gmail not connected")) {
      return NextResponse.json({ error: "not_connected" }, { status: 503 });
    }
    if (err.message?.includes("not accessible")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch message" }, { status: 500 });
  }
}
