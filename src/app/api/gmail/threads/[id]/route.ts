import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClient, getHeader, extractBody } from "@/lib/gmail";

const SHARED_EMAIL = "info@aequoradigital.com";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const gmail = await getGmailClient();

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

    const messages = (thread.data.messages ?? []).map((msg) => {
      const headers = msg.payload?.headers ?? [];
      const from = getHeader(headers, "From");
      const to = getHeader(headers, "To");
      const isOutgoing = from.toLowerCase().includes(SHARED_EMAIL);
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
      messages,
    });
  } catch (err: any) {
    if (err.message?.includes("Gmail not connected")) {
      return NextResponse.json({ error: "not_connected" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to fetch thread" }, { status: 500 });
  }
}
