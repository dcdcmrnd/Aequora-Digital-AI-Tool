import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { seedPageContent } from "@/lib/site-builder/seedContent";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const pageSchema = z.object({
  title: z.string().min(1, "Title is required."),
  slug: z.string().regex(SLUG_PATTERN, "Slug must be lowercase letters, numbers, and hyphens only."),
  isHomepage: z.boolean().default(false),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pages = await prisma.page.findMany({ where: { siteId: params.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ pages });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const site = await prisma.site.findUnique({ where: { id: params.id } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const body = await req.json();
  const parsed = pageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid page." }, { status: 400 });
  }

  const clash = await prisma.page.findUnique({ where: { siteId_slug: { siteId: site.id, slug: parsed.data.slug } } });
  if (clash) return NextResponse.json({ error: "That slug is already used by another page on this site." }, { status: 409 });

  // Only one homepage per site -- enforced here in application code, not the DB
  // (same pattern as GmailToken.isPrimary), since demoting the previous homepage
  // is a decision the app makes, not a constraint the DB can express directly.
  if (parsed.data.isHomepage) {
    await prisma.page.updateMany({ where: { siteId: site.id, isHomepage: true }, data: { isHomepage: false } });
  }

  const page = await prisma.page.create({
    data: {
      siteId: site.id,
      title: parsed.data.title,
      slug: parsed.data.slug,
      isHomepage: parsed.data.isHomepage,
      draftContent: JSON.stringify(seedPageContent(parsed.data.title)),
    },
  });

  return NextResponse.json({ page }, { status: 201 });
}
