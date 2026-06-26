import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hasPermission = await checkPermission(session.user.id, "admin.users");
  if (!hasPermission && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.companyDocument.findMany({
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, url, fileSize, mimeType } = body;

  if (!name?.trim() || !url) {
    return NextResponse.json({ error: "Name and URL are required." }, { status: 400 });
  }

  const document = await prisma.companyDocument.create({
    data: {
      name: name.trim(),
      description: description || null,
      url,
      fileSize: fileSize ?? null,
      mimeType: mimeType ?? null,
      uploadedById: session.user.id,
    },
    include: { uploadedBy: { select: { name: true } } },
  });

  return NextResponse.json({ document });
}
