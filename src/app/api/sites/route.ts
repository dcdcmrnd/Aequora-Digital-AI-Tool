import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const siteSchema = z.object({
  name: z.string().min(1, "Name is required."),
  slug: z.string().regex(SLUG_PATTERN, "Slug must be lowercase letters, numbers, and hyphens only."),
  contactId: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sites = await prisma.site.findMany({
    include: { pages: { select: { id: true, title: true, slug: true, isHomepage: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = siteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid site." }, { status: 400 });
  }

  const existing = await prisma.site.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return NextResponse.json({ error: "That slug is already in use." }, { status: 409 });
  }

  const site = await prisma.site.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      contactId: parsed.data.contactId || undefined,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ site }, { status: 201 });
}
