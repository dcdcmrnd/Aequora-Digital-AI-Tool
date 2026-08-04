import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { pushRunToNextStep, removeRunFromWorkflow } from "@/lib/automation/engine";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const MAX_RUNS_PER_REQUEST = 200;

/** "Remove from Workflow" / "Push to Next Step" for a batch of contacts' runs — the builder's per-step contact list bulk actions. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { runIds, action } = await req.json();
  if (action !== "remove" && action !== "advance") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (!Array.isArray(runIds) || runIds.length === 0 || !runIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "No contacts selected" }, { status: 400 });
  }
  if (runIds.length > MAX_RUNS_PER_REQUEST) {
    return NextResponse.json({ error: `Select ${MAX_RUNS_PER_REQUEST} or fewer at a time` }, { status: 400 });
  }

  // Only act on runs that actually belong to this automation, ignoring any stale/foreign ids.
  const owned = await prisma.automationRun.findMany({
    where: { id: { in: runIds }, automationId: params.id },
    select: { id: true },
  });

  const results = await Promise.all(
    owned.map((run) => (action === "remove" ? removeRunFromWorkflow(run.id) : pushRunToNextStep(run.id))),
  );

  return NextResponse.json({ success: true, count: results.filter(Boolean).length });
}
