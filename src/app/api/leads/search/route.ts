import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { executeSearch } from "@/services/search";

// Fetching up to 60 leads (paginated Google calls) plus auditing/enriching each
// takes longer than the platform default — give it real headroom.
export const maxDuration = 60;

const searchSchema = z.object({
  // Optional — an empty keyword browses every business Google returns for
  // the location alone, instead of narrowing to one category.
  keyword: z.string(),
  location: z.string().min(1),
  radiusMeters: z.number().int().positive().max(50_000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "admin";
  const canManage = isAdmin || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a location to search." }, { status: 400 });
  }

  const result = await executeSearch({ userId: session.user.id, ...parsed.data });

  return NextResponse.json(result);
}
