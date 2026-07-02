import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClient, getHeader } from "@/lib/gmail";
import { checkPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canAccessInbox = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
  if (!canAccessInbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const pageToken = searchParams.get("pageToken") ?? undefined;
  const labelId = searchParams.get("label") ?? "INBOX";

  try {
    const gmail = await getGmailClient();

    const listRes = await gmail.users.messages.list({
      userId: "me",
      labelIds: [labelId],
      maxResults: 30,
      pageToken,
    });

    const messageIds = listRes.data.messages ?? [];

    const messages = await Promise.all(
      messageIds.map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });

        const headers = msg.data.payload?.headers ?? [];
        return {
          id: msg.data.id,
          threadId: msg.data.threadId,
          snippet: msg.data.snippet,
          isUnread: msg.data.labelIds?.includes("UNREAD") ?? false,
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          subject: getHeader(headers, "Subject"),
          date: getHeader(headers, "Date"),
        };
      })
    );

    return NextResponse.json({
      messages,
      nextPageToken: listRes.data.nextPageToken ?? null,
    });
  } catch (err: any) {
    if (err.message?.includes("Gmail not connected")) {
      return NextResponse.json({ error: "not_connected" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
