import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { extractBody, getConnectedEmail, getGmailClient, getHeader } from "@/lib/gmail";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// Up to 15 threads, each fetched in full (all messages, all bodies) -- can
// legitimately take a while for a contact with a long history.
export const maxDuration = 60;
const MAX_THREADS = 15;

interface EmailTimelineItem {
  type: "email";
  id: string;
  threadId: string;
  date: string;
  from: string;
  to: string;
  isOutgoing: boolean;
  /** Gmail's own UNREAD label on this specific message -- never true for isOutgoing (Gmail doesn't mark your own sent mail unread). */
  isUnread: boolean;
  subject: string;
  html: string;
  text: string;
}

interface CallTimelineItem {
  type: "call";
  id: string;
  date: string;
  status: string;
  durationSec: number | null;
  recordingSid: string | null;
  answeredBy: string | null;
  userName: string;
}

/** Merges every email (across all threads with this contact) and every call into one date-sorted feed — the middle column of the Conversations view. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canAccessInbox = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
  if (!canAccessInbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contact = await prisma.contact.findUnique({ where: { id: params.id } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const emailItems: EmailTimelineItem[] = [];
  let gmailConnected = true;

  if (contact.email) {
    try {
      const gmail = await getGmailClient(null);
      const connectedEmail = (await getConnectedEmail(null))?.toLowerCase() ?? "";
      const listRes = await gmail.users.threads.list({
        userId: "me",
        q: `from:${contact.email} OR to:${contact.email}`,
        maxResults: MAX_THREADS,
      });

      for (const t of listRes.data.threads ?? []) {
        if (!t.id) continue;
        const full = await gmail.users.threads.get({ userId: "me", id: t.id, format: "full" });
        for (const msg of full.data.messages ?? []) {
          const headers = msg.payload?.headers ?? [];
          const from = getHeader(headers, "From");
          const to = getHeader(headers, "To");
          const isOutgoing = connectedEmail !== "" && from.toLowerCase().includes(connectedEmail);
          const { html, text } = extractBody(msg.payload);

          emailItems.push({
            type: "email",
            id: msg.id ?? `${t.id}-${emailItems.length}`,
            threadId: t.id,
            date: new Date(Number(msg.internalDate ?? 0)).toISOString(),
            from,
            to,
            isOutgoing,
            isUnread: !isOutgoing && !!msg.labelIds?.includes("UNREAD"),
            subject: getHeader(headers, "Subject"),
            html,
            text,
          });
        }
      }
    } catch (err: any) {
      // No connected Gmail account, or a transient API failure -- the
      // timeline still shows calls below rather than failing outright.
      gmailConnected = !err?.message?.includes("Gmail not connected");
    }
  }

  const calls = await prisma.call.findMany({
    where: { contactId: contact.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const callItems: CallTimelineItem[] = calls.map((c) => ({
    type: "call",
    id: c.id,
    date: c.createdAt.toISOString(),
    status: c.status,
    durationSec: c.durationSec,
    recordingSid: c.recordingSid,
    answeredBy: c.answeredBy,
    userName: c.user.name,
  }));

  const items = [...emailItems, ...callItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({ items, gmailConnected, contactEmail: contact.email });
}
