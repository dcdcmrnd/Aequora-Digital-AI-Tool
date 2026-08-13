import { escapeLikePattern } from "@/lib/db";
import { prisma } from "@/lib/prisma";

/**
 * Looks up an existing contact by email (case-insensitive) — used to link
 * threads in the shared Conversations inbox (info@aequoradigital.com) to an
 * already-known CRM contact, if there is one. Deliberately does NOT create
 * one: not every sender in that inbox is someone worth keeping as a contact
 * (newsletters, notifications, one-off senders), so contact creation from
 * email is an explicit user action (see the "Save as Contact" button in the
 * conversation view) rather than automatic. Not used for each team member's
 * own personal Inbox — that's their individual mail, not agency contacts.
 */
export async function findContactByEmail(email: string): Promise<string | null> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !trimmedEmail.includes("@")) return null;

  const existing = await prisma.contact.findFirst({
    where: { email: { equals: escapeLikePattern(trimmedEmail), mode: "insensitive" } },
    select: { id: true },
  });
  return existing?.id ?? null;
}
