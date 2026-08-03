import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClient, getConnectedEmail, getHeader, extractBody } from "@/lib/gmail";
import { checkPermission } from "@/lib/permissions";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = new URL(req.url).searchParams;
  const scopeParam = searchParams.get("scope");
  if (scopeParam !== "own" && scopeParam !== "agency") {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  if (scopeParam === "agency") {
    const canAccessInbox = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
    if (!canAccessInbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownerId = scopeParam === "own" ? session.user.id : null;
  const account = searchParams.get("email") ?? undefined;

  try {
    const gmail = await getGmailClient(ownerId, account);
    const connectedEmail = (account ?? (await getConnectedEmail(ownerId)))?.toLowerCase() ?? "";

    const thread = await gmail.users.threads.get({
      userId: "me",
      id: params.id,
      format: "full",
    });

    // Mark all unread messages as read
    const unreadIds = (thread.data.messages ?? [])
      .filter((m) => m.labelIds?.includes("UNREAD"))
      .map((m) => m.id!);

    if (unreadIds.length > 0) {
      await Promise.all(
        unreadIds.map((id) =>
          gmail.users.messages.modify({
            userId: "me",
            id,
            requestBody: { removeLabelIds: ["UNREAD"] },
          })
        )
      );
    }

    const hadUnread = (thread.data.messages ?? []).some((m) => m.labelIds?.includes("UNREAD"));

    const messages = (thread.data.messages ?? []).map((msg) => {
      const headers = msg.payload?.headers ?? [];
      const from = getHeader(headers, "From");
      const to = getHeader(headers, "To");
      const isOutgoing = connectedEmail !== "" && from.toLowerCase().includes(connectedEmail);
      const { html, text } = extractBody(msg.payload);

      return {
        id: msg.id,
        from,
        to,
        subject: getHeader(headers, "Subject"),
        date: getHeader(headers, "Date"),
        isOutgoing,
        html,
        text,
      };
    });

    const firstHeaders = thread.data.messages?.[0]?.payload?.headers ?? [];

    return NextResponse.json({
      id: params.id,
      subject: getHeader(firstHeaders, "Subject"),
      status: hadUnread ? "unread" : "read",
      messages,
    });
  } catch (err: any) {
    if (err.message?.includes("Gmail not connected")) {
      return NextResponse.json({ error: "not_connected" }, { status: 503 });
    }
    if (err.message?.includes("not accessible")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch thread" }, { status: 500 });
  }
}
