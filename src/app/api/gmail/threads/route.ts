import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClient, getConnectedEmail, getHeader } from "@/lib/gmail";
import { checkPermission } from "@/lib/permissions";

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

  const canAccessInbox = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
  if (!canAccessInbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const pageToken = searchParams.get("pageToken") ?? undefined;
  const labelId = searchParams.get("label");
  const q = searchParams.get("q") ?? undefined;
  const account = searchParams.get("email") ?? undefined;

  try {
    const gmail = await getGmailClient(account);
    const connectedEmail = (account ?? (await getConnectedEmail()))?.toLowerCase() ?? "";

    // A contact-scoped search (q) intentionally omits the label filter so it
    // finds messages across Inbox and Sent, not just one folder.
    const listRes = await gmail.users.threads.list({
      userId: "me",
      ...(q ? { q } : { labelIds: [labelId ?? "INBOX"] }),
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
        const isOutgoing = connectedEmail !== "" && from.toLowerCase().includes(connectedEmail);
        const contact = extractContact(from, to, isOutgoing);
        const isUnread = messages.some((m) => m.labelIds?.includes("UNREAD"));

        return {
          id: t.id,
          subject: getHeader(headers, "Subject"),
          snippet: last?.snippet ?? "",
          date: getHeader(headers, "Date"),
          isUnread,
          status: isUnread ? "unread" : "read",
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
