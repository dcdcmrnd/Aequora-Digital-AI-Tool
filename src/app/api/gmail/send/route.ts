import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { escapeLikePattern } from "@/lib/db";
import { verifyAndCacheForContacts } from "@/lib/emailVerification";
import { sendEmail } from "@/lib/gmail";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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
    const firstRecipient = (to as string).split(",")[0]?.trim();
    const contact = firstRecipient
      ? await prisma.contact.findFirst({ where: { email: { equals: escapeLikePattern(firstRecipient), mode: "insensitive" } } })
      : null;

    if (contact?.emailBounced) {
      return NextResponse.json(
        { error: `A previous email to this address bounced${contact.emailBounceReason ? ` (${contact.emailBounceReason})` : ""}. Update the contact's email before sending again.` },
        { status: 400 },
      );
    }

    if (firstRecipient) {
      const status = await verifyAndCacheForContacts(firstRecipient);
      if (status === "invalid") {
        return NextResponse.json(
          { error: "This address failed verification — invalid format or the domain can't receive mail. Double-check it before sending." },
          { status: 400 },
        );
      }
    }

    const trackingToken = crypto.randomBytes(16).toString("hex");
    await prisma.emailTracking.create({ data: { token: trackingToken, contactId: contact?.id } });

    const result = await sendEmail({ to, subject, body, threadId, inReplyTo, references, fromEmail, trackingToken }, ownerId);

    await prisma.emailTracking.update({
      where: { token: trackingToken },
      data: { gmailMessageId: result.id ?? undefined, gmailThreadId: result.threadId ?? undefined },
    });

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
