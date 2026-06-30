import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClient, getHeader } from "@/lib/gmail";

const SHARED_EMAIL = "info@aequoradigital.com";

function extractContact(from: string, to: string, isOutgoing: boolean) {
  const raw = isOutgoing ? to : from;
  const match = raw.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  return {
    name: match?.[1]?.trim() || raw,
    email: match?.[2]?.trim() || raw,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pageToken = searchParams.get("pageToken") ?? undefined;
  const labelId = searchParams.get("label") ?? "INBOX";

  try {
    const gmail = await getGmailClient();

    const listRes = await gmail.users.threads.list({
      userId: "me",
      labelIds: [labelId],
      maxResults: 30,
      pageToken,
    });

    const threadItems = listRes.data.threads ?? [];

    const threads = await Promise.all(
      threadItems.map(async (t) => {
        const thread = await gmail.users.threads.get({
          userId: "me",
          id: t.id!,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });

        const messages = thread.data.messages ?? [];
        const last = messages[messages.length - 1];
        const headers = last?.payload?.headers ?? [];
        const from = getHeader(headers, "From");
        const to = getHeader(headers, "To");
        const isOutgoing = from.toLowerCase().includes(SHARED_EMAIL);
        const contact = extractContact(from, to, isOutgoing);
        const isUnread = messages.some((m) => m.labelIds?.includes("UNREAD"));

        return {
          id: t.id,
          subject: getHeader(headers, "Subject"),
          snippet: last?.snippet ?? "",
          date: getHeader(headers, "Date"),
          isUnread,
          messageCount: messages.length,
          contactName: contact.name,
          contactEmail: contact.email,
        };
      })
    );

    return NextResponse.json({
      threads,
      nextPageToken: listRes.data.nextPageToken ?? null,
    });
  } catch (err: any) {
    if (err.message?.includes("Gmail not connected")) {
      return NextResponse.json({ error: "not_connected" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to fetch threads" }, { status: 500 });
  }
}
