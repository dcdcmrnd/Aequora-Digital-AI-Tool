import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOrCreateOwnContact(userId: string, email: string, name: string) {
  let contact = await prisma.contact.findFirst({ where: { email } });
  if (!contact) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    contact = await prisma.contact.create({
      data: {
        name,
        firstName: parts[0] || undefined,
        lastName: parts.slice(1).join(" ") || undefined,
        email,
        tags: JSON.stringify(["team member"]),
        createdById: userId,
      },
    });
  }
  return contact;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contact = await getOrCreateOwnContact(session.user.id, session.user.email, session.user.name ?? "");
  return NextResponse.json({ contact: { ...contact, tags: JSON.parse(contact.tags) } });
}

const updateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  const contact = await getOrCreateOwnContact(session.user.id, session.user.email, session.user.name ?? "");
  const firstName = parsed.data.firstName?.trim() ?? contact.firstName ?? "";
  const lastName = parsed.data.lastName?.trim() ?? contact.lastName ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || contact.name;

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data: {
      name,
      firstName: parsed.data.firstName !== undefined ? parsed.data.firstName.trim() || null : undefined,
      lastName: parsed.data.lastName !== undefined ? parsed.data.lastName.trim() || null : undefined,
      company: parsed.data.company !== undefined ? parsed.data.company.trim() || null : undefined,
      phone: parsed.data.phone !== undefined ? parsed.data.phone.trim() || null : undefined,
      website: parsed.data.website !== undefined ? parsed.data.website.trim() || null : undefined,
      notes: parsed.data.notes !== undefined ? parsed.data.notes.trim() || null : undefined,
    },
  });

  return NextResponse.json({ contact: { ...updated, tags: JSON.parse(updated.tags) } });
}
