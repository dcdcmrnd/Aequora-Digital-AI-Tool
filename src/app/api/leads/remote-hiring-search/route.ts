import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { discoverRemoteHiring } from "@/services/remoteHiring";

// Same reasoning as people-search/route.ts: a Places lookup plus a site
// crawl per company, capped to fit inside Vercel Hobby's 60s ceiling.
export const maxDuration = 60;

const schema = z.object({
  keyword: z.string().trim().min(1),
  location: z.string().trim().optional(),
});

/**
 * Finds companies currently posting remote-hiring job ads (via Remotive),
 * best-effort matches each to a real business via Google Places, and crawls
 * matched companies' websites for a named contact -- same pipeline as
 * People Search, just sourced from live hiring signals instead of an
 * Industry + Location business search.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a role or keyword to search for." }, { status: 400 });

  let result;
  try {
    result = await discoverRemoteHiring(session.user.id, parsed.data.keyword, parsed.data.location);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't reach the remote job board." },
      { status: 502 },
    );
  }

  await logActivity({
    userId: session.user.id,
    action: "created",
    entityType: "people_search",
    entityId: result.searchId,
    entityName: `Remote hiring: ${parsed.data.keyword}`,
    metadata: {
      jobsFound: result.jobsFound,
      companiesMatched: result.companiesMatched,
      peopleFound: result.peopleFound,
    },
  });

  return NextResponse.json(result);
}
