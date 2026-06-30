import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClient } from "@/lib/gmail";

function encodeEmail(fields: {
  to: string;
  from: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `From: ${fields.from}`,
    `To: ${fields.to}`,
    `Subject: ${fields.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
  ];
  if (fields.inReplyTo) lines.push(`In-Reply-To: ${fields.inReplyTo}`);
  if (fields.references) lines.push(`References: ${fields.references}`);
  lines.push("", fields.body);

  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to, subject, body, threadId, inReplyTo, references } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  try {
    const gmail = await getGmailClient();

    const raw = encodeEmail({
      to,
      from: "Aequora Digital <info@aequoradigital.com>",
      subject,
      body,
      inReplyTo,
      references,
    });

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw, threadId },
    });

    return NextResponse.json({ id: res.data.id, threadId: res.data.threadId });
  } catch (err: any) {
    if (err.message?.includes("Gmail not connected")) {
      return NextResponse.json({ error: "not_connected" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
