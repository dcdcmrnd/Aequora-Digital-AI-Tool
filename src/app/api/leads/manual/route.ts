import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { runManualLeadAudit } from "@/services/search";

// PageSpeed audits can take a while — give this real headroom, same reasoning as /api/leads/search.
export const maxDuration = 60;

const manualLeadSchema = z
  .object({
    name: z.string().trim().optional(),
    website: z.string().trim().optional(),
  })
  .refine((data) => !!data.name || !!data.website, { message: "Enter a business name or website." });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "admin";
  const canManage = isAdmin || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = manualLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  try {
    const lead = await runManualLeadAudit({ userId: session.user.id, ...parsed.data });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't audit this business." },
      { status: 400 },
    );
  }
}
