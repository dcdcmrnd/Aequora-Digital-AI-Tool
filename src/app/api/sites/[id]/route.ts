import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().regex(SLUG_PATTERN, "Slug must be lowercase letters, numbers, and hyphens only.").optional(),
  contactId: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const site = await prisma.site.findUnique({
    where: { id: params.id },
    include: { pages: { orderBy: { createdAt: "asc" } } },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ site });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.site.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update." }, { status: 400 });
  }

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const clash = await prisma.site.findUnique({ where: { slug: parsed.data.slug } });
    if (clash) return NextResponse.json({ error: "That slug is already in use." }, { status: 409 });
  }

  const site = await prisma.site.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.slug !== undefined && { slug: parsed.data.slug }),
      ...(parsed.data.contactId !== undefined && { contactId: parsed.data.contactId }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
    },
  });

  return NextResponse.json({ site });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "sites.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.site.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.site.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
