import { NextRequest, NextResponse } from "next/server";

import { resumeRun } from "@/lib/automation/engine";
import { prisma } from "@/lib/prisma";

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
