import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  contactIds: z.array(z.string()).min(1).max(1000),
  company: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { contactIds, company, website, notes } = parsed.data;
  const data: Record<string, string> = {};
  if (company?.trim()) data.company = company.trim();
  if (website?.trim()) data.website = website.trim();
  if (notes?.trim()) data.notes = notes.trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { count } = await prisma.contact.updateMany({ where: { id: { in: contactIds } }, data });
  return NextResponse.json({ updated: count });
}
