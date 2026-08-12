import { NextRequest, NextResponse } from "next/server";

import { createNotification } from "@/lib/activity";
import { extractBody, getGmailClient, getHeader } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";

const MAX_CANDIDATES_PER_ACCOUNT = 25;
const MAX_NOTIFICATIONS_PER_ACCOUNT = 10;

// How far back to look for an outbound send this inbound message might be a
// bounce/reply to -- bounces almost always land within minutes to hours,
// but a slow bounce or a real reply can take longer, so this stays generous.
const TRACKING_LOOKBACK_DAYS = 14;

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  return match?.[1]?.trim() || from;
}

const BOUNCE_SENDER_PATTERN = /mailer-daemon|postmaster|mail delivery/i;
const BOUNCE_SUBJECT_PATTERN = /undeliver|delivery status|delivery.{0,10}fail|mail delivery|returned mail|failure notice|delivery.{0,10}notif|couldn'?t be delivered/i;

function looksLikeBounce(from: string, subject: string): boolean {
  return BOUNCE_SENDER_PATTERN.test(from) || BOUNCE_SUBJECT_PATTERN.test(subject);
}

/** Best-effort short reason from a bounce body — an SMTP status/reason line if one is found, otherwise just the subject. */
function extractBounceReason(bodyText: string, subject: string): string {
  const statusLine = bodyText.match(/\b5\d\d[ -]\d\.\d\.\d[^\n\r]*/);
  if (statusLine) return statusLine[0].trim().slice(0, 200);
  const reasonLine = bodyText.split(/\r?\n/).find((line) => /fail|reject|does not exist|unknown user|no such user/i.test(line));
  return (reasonLine ?? subject).trim().slice(0, 200);
}

/**
 * Runs once daily (Vercel Hobby plan caps cron frequency at once/day — see
 * vercel.json) and checks every connected Gmail account for messages
 * received since its last check, notifying the right people: the owner for
 * a personal account, everyone with inbox access for the shared agency
 * account. Not real-time, but the best available without a paid plan.
 */
// See resume-automations/route.ts for why this is required on every cron route.
export const dynamic = "force-dynamic";

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
        const fromHeader = getHeader(headers, "From");
        const from = extractSenderName(fromHeader);
        const subject = getHeader(headers, "Subject") || "(no subject)";
        const threadId = message.data.threadId;

        // Reply detection: this inbound message landed on a thread we sent
        // and tracked -- Gmail threads a reply together with the original
        // by subject/In-Reply-To, so matching on threadId is precise enough
        // not to need a date bound.
        if (threadId) {
          await prisma.emailTracking.updateMany({
            where: { gmailThreadId: threadId, repliedAt: null },
            data: { repliedAt: new Date(internalDate || Date.now()) },
          });
        }

        // Bounce detection: only for messages shaped like a delivery
        // failure -- fetch the full body only then, and match it against
        // recent not-yet-bounced sends by searching for the recipient's own
        // address in the bounce report text (DSN formats vary too much to
        // parse structurally, but the failed address is always present as
        // plain text somewhere in the report).
        if (looksLikeBounce(fromHeader, subject)) {
          const full = await gmail.users.messages.get({ userId: "me", id: item.id, format: "full" });
          const { text, html } = extractBody(full.data.payload);
          const bodyText = (text || html.replace(/<[^>]+>/g, " ")).toLowerCase();

          const lookbackDate = new Date(Date.now() - TRACKING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
          const recentSends = await prisma.emailTracking.findMany({
            where: { bounced: false, createdAt: { gte: lookbackDate }, contactId: { not: null } },
            include: { contact: { select: { id: true, email: true } } },
          });

          for (const send of recentSends) {
            const contactEmail = send.contact?.email;
            if (!contactEmail || !bodyText.includes(contactEmail.toLowerCase())) continue;

            const reason = extractBounceReason(bodyText, subject);
            await prisma.emailTracking.update({
              where: { id: send.id },
              data: { bounced: true, bouncedAt: new Date(), bounceReason: reason },
            });
            await prisma.contact.update({
              where: { id: send.contactId! },
              data: { emailBounced: true, emailBouncedAt: new Date(), emailBounceReason: reason },
            });
          }
        }

        if (notifiedForThisAccount < MAX_NOTIFICATIONS_PER_ACCOUNT) {
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
      }

      await prisma.gmailToken.update({ where: { id: token.id }, data: { lastCheckedAt: checkedAt } });
    } catch (error) {
      console.error(`[check-new-mail] Failed for ${token.email}:`, error);
    }
  }

  return NextResponse.json({ accountsChecked: tokens.length, notificationsSent: notified });
}
