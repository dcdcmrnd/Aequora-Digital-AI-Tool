import { NextRequest, NextResponse } from "next/server";

import { createNotification } from "@/lib/activity";
import { getGmailClient, getHeader } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";

const MAX_CANDIDATES_PER_ACCOUNT = 25;
const MAX_NOTIFICATIONS_PER_ACCOUNT = 10;

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  return match?.[1]?.trim() || from;
}

/**
 * Runs once daily (Vercel Hobby plan caps cron frequency at once/day — see
 * vercel.json) and checks every connected Gmail account for messages
 * received since its last check, notifying the right people: the owner for
 * a personal account, everyone with inbox access for the shared agency
 * account. Not real-time, but the best available without a paid plan.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await prisma.gmailToken.findMany();
  let notified = 0;

  const agencyRecipientIds = await prisma.user
    .findMany({
      where: { status: "active", OR: [{ role: "admin" }, { permissions: { some: { permissionType: "company.email" } } }] },
      select: { id: true },
    })
    .then((users) => users.map((u) => u.id));

  for (const token of tokens) {
    try {
      const since = token.lastCheckedAt;
      const checkedAt = new Date();

      // First-ever check for this account — start watching from now instead
      // of flooding recipients with notifications for its entire history.
      if (!since) {
        await prisma.gmailToken.update({ where: { id: token.id }, data: { lastCheckedAt: checkedAt } });
        continue;
      }

      const gmail = await getGmailClient(token.ownerId, token.email);
      const listRes = await gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
        maxResults: MAX_CANDIDATES_PER_ACCOUNT,
      });
      const candidates = listRes.data.messages ?? [];

      const recipients = token.ownerId ? [token.ownerId] : agencyRecipientIds;
      const entityType = token.ownerId ? "inbox" : "conversations";

      let notifiedForThisAccount = 0;
      for (const item of candidates) {
        if (notifiedForThisAccount >= MAX_NOTIFICATIONS_PER_ACCOUNT) break;
        if (!item.id) continue;

        const message = await gmail.users.messages.get({
          userId: "me",
          id: item.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject"],
        });

        const internalDate = Number(message.data.internalDate ?? 0);
        if (internalDate <= since.getTime()) continue;

        const headers = message.data.payload?.headers ?? [];
        const from = extractSenderName(getHeader(headers, "From"));
        const subject = getHeader(headers, "Subject") || "(no subject)";

        await Promise.all(
          recipients.map((userId) =>
            createNotification({
              userId,
              type: "new_email",
              title: `New email from ${from}`,
              body: subject,
              entityType,
              entityId: token.ownerId ?? "agency",
            }),
          ),
        );
        notifiedForThisAccount += 1;
        notified += 1;
      }

      await prisma.gmailToken.update({ where: { id: token.id }, data: { lastCheckedAt: checkedAt } });
    } catch (error) {
      console.error(`[check-new-mail] Failed for ${token.email}:`, error);
    }
  }

  return NextResponse.json({ accountsChecked: tokens.length, notificationsSent: notified });
}
