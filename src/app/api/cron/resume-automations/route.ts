import { NextRequest, NextResponse } from "next/server";

import { resumeRun } from "@/lib/automation/engine";
import { prisma } from "@/lib/prisma";

// Without this, Next.js can statically cache this route's response at build
// time (it has no dynamic-forcing API calls otherwise), so Vercel's daily
// cron invocation would just replay a frozen response from build time
// instead of actually re-running the resume logic -- confirmed against
// Vercel's own cron troubleshooting docs as the standard cause of a cron
// that appears to fire on schedule but never does anything.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueRuns = await prisma.automationRun.findMany({
    where: { status: "waiting", waitUntil: { lte: new Date() } },
    select: { id: true },
  });

  for (const run of dueRuns) {
    await resumeRun(run.id);
  }

  return NextResponse.json({ resumed: dueRuns.length });
}
