import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findContactByEmail } from "@/lib/contactLinking";
import { archiveThread, extractBody, extractContact, getConnectedEmail, getGmailClient, getHeader, trashThread } from "@/lib/gmail";
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

    // Link this thread's other party to an existing CRM contact if there is
    // one — same as the thread list, and same scope restriction (agency
    // inbox only). Never creates a new contact; contactName/contactEmail are
    // still returned so the client can offer a manual "Save as Contact".
    let contactId: string | null = null;
    let contactName: string | null = null;
    let contactEmail: string | null = null;
    if (scopeParam === "agency") {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        const contact = extractContact(lastMessage.from, lastMessage.to, lastMessage.isOutgoing);
        const match = await findContactByEmail(contact.email);
        contactId = match?.id ?? null;
        contactName = match?.name ?? contact.name;
        contactEmail = contact.email;
      }
    }

    return NextResponse.json({
      id: params.id,
      subject: getHeader(firstHeaders, "Subject"),
      status: hadUnread ? "unread" : "read",
      messages,
      contactId,
      contactName,
      contactEmail,
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, scope, email } = await req.json();
  if (scope !== "own" && scope !== "agency") {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }
  if (action !== "archive" && action !== "trash") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (scope === "agency") {
    const canAccessInbox = session.user.role === "admin" || (await checkPermission(session.user.id, "company.email"));
    if (!canAccessInbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownerId = scope === "own" ? session.user.id : null;

  try {
    if (action === "archive") {
      await archiveThread(ownerId, email, params.id);
    } else {
      await trashThread(ownerId, email, params.id);
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes("Gmail not connected")) {
      return NextResponse.json({ error: "not_connected" }, { status: 503 });
    }
    if (err.message?.includes("not accessible")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: `Failed to ${action} thread` }, { status: 500 });
  }
}
