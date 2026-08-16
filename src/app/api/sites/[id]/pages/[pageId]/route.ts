import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const publishSchema = z.object({ publish: z.literal(true) });

const fieldUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().regex(SLUG_PATTERN, "Slug must be lowercase letters, numbers, and hyphens only.").optional(),
  isHomepage: z.boolean().optional(),
  draftContent: z.string().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  ogImageUrl: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  noIndex: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string; pageId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const page = await prisma.page.findFirst({ where: { id: params.pageId, siteId: params.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ page });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; pageId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.page.findFirst({ where: { id: params.pageId, siteId: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // Publish is a distinct action, not a field update: it copies draftContent -> publishedContent,
  // stamps publishedAt, flips status, and appends an immutable PageVersion snapshot. Further draft
  // edits never reach the public site until this runs again.
  const publishParsed = publishSchema.safeParse(body);
  if (publishParsed.success) {
    const [page] = await prisma.$transaction([
      prisma.page.update({
        where: { id: existing.id },
        data: { publishedContent: existing.draftContent, publishedAt: new Date(), status: "published" },
      }),
      prisma.pageVersion.create({
        data: { pageId: existing.id, content: existing.draftContent, label: "Published", createdById: session.user.id },
      }),
      prisma.site.update({ where: { id: params.id }, data: { status: "published" } }),
    ]);
    return NextResponse.json({ page });
  }

  const parsed = fieldUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update." }, { status: 400 });
  }

  if (parsed.data.draftContent !== undefined) {
    try {
      JSON.parse(parsed.data.draftContent);
    } catch {
      return NextResponse.json({ error: "draftContent must be valid JSON." }, { status: 400 });
    }
  }

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const clash = await prisma.page.findUnique({ where: { siteId_slug: { siteId: params.id, slug: parsed.data.slug } } });
    if (clash) return NextResponse.json({ error: "That slug is already used by another page on this site." }, { status: 409 });
  }

  if (parsed.data.isHomepage) {
    await prisma.page.updateMany({ where: { siteId: params.id, isHomepage: true }, data: { isHomepage: false } });
  }

  const page = await prisma.page.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.slug !== undefined && { slug: parsed.data.slug }),
      ...(parsed.data.isHomepage !== undefined && { isHomepage: parsed.data.isHomepage }),
      ...(parsed.data.draftContent !== undefined && { draftContent: parsed.data.draftContent }),
      ...(parsed.data.metaTitle !== undefined && { metaTitle: parsed.data.metaTitle }),
      ...(parsed.data.metaDescription !== undefined && { metaDescription: parsed.data.metaDescription }),
      ...(parsed.data.ogImageUrl !== undefined && { ogImageUrl: parsed.data.ogImageUrl }),
      ...(parsed.data.canonicalUrl !== undefined && { canonicalUrl: parsed.data.canonicalUrl }),
      ...(parsed.data.noIndex !== undefined && { noIndex: parsed.data.noIndex }),
    },
  });

  return NextResponse.json({ page });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; pageId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.page.findFirst({ where: { id: params.pageId, siteId: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.page.delete({ where: { id: existing.id } });
  return NextResponse.json({ success: true });
}
