import { prisma } from "@/lib/prisma";

/**
 * Finds an existing contact by email (case-insensitive), or creates one —
 * auto-links the shared Conversations inbox (info@aequoradigital.com) to the
 * Contacts CRM so every business email received has a contact behind it.
 * Deliberately not used for each team member's own personal Inbox — that's
 * their individual mail, not agency business contacts.
 */
export async function findOrCreateContactByEmail(
  email: string,
  name: string,
  createdById: string,
): Promise<string | null> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !trimmedEmail.includes("@")) return null;

  const existing = await prisma.contact.findFirst({
    where: { email: { equals: trimmedEmail, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.contact.create({
    data: { name: name.trim() || trimmedEmail, email: trimmedEmail, createdById },
    select: { id: true },
  });
  return created.id;
}
