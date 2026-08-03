import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contacts = await prisma.contact.findMany({ select: { tags: true } });
  const tagSet = new Set<string>();
  for (const c of contacts) {
    try {
      (JSON.parse(c.tags) as string[]).forEach((t) => tagSet.add(t));
    } catch {
      // skip malformed rows
    }
  }

  return NextResponse.json({ tags: Array.from(tagSet).sort() });
}
