import { NextRequest, NextResponse } from "next/server";

import { resumeRun } from "@/lib/automation/engine";
import { prisma } from "@/lib/prisma";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

// Without this, Next.js can statically cache this route's response at build
// time (it has no dynamic-forcing API calls otherwise), so Vercel's daily
// cron invocation would just replay a frozen response from build time
// instead of actually re-running the resume logic -- confirmed against
// Vercel's own cron troubleshooting docs as the standard cause of a cron
// that appears to fire on schedule but never does anything.
export const dynamic = "force-dynamic";

// This route used to run every due run sequentially with no maxDuration
// set at all, which defaults to Vercel's platform limit (10s on Hobby) --
// on a day with more than a handful of due runs (each a full workflow
// step, sometimes sending a real email), the function timed out partway
// through prisma's findMany result order, so the same early runs kept
// getting resumed every day while everything later in the list never got
// reached at all. Concurrency + an explicit 60s budget lets far more of
// the queue actually drain per invocation instead of starving silently.
export const maxDuration = 60;
const RESUME_CONCURRENCY = 5;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueRuns = await prisma.automationRun.findMany({
    where: { status: "waiting", waitUntil: { lte: new Date() } },
    select: { id: true },
  });

  // resumeRun catches its own errors (marks the run "error" rather than
  // throwing) so one bad run can never abort the rest of this batch.
  await mapWithConcurrency(dueRuns, RESUME_CONCURRENCY, (run) => resumeRun(run.id));

  return NextResponse.json({ resumed: dueRuns.length });
}
