import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, logoUrl, primaryColor } = body;

  const settings = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {
      ...(name?.trim() && { name: name.trim() }),
      ...(description !== undefined && { description: description || null }),
      ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
      ...(primaryColor?.trim() && { primaryColor: primaryColor.trim() }),
    },
    create: {
      id: "singleton",
      name: name?.trim() || "Aequora Digital",
      description: description || null,
      logoUrl: logoUrl || null,
      primaryColor: primaryColor || "#0F7B8A",
    },
  });

  return NextResponse.json({ settings });
}
