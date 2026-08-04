import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { pushRunToNextStep, removeRunFromWorkflow } from "@/lib/automation/engine";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** "Remove from Workflow" / "Push to Next Step" for one contact's run — same permission gate as enrolling contacts into a workflow. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; runId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "automation.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const run = await prisma.automationRun.findUnique({ where: { id: params.runId } });
  if (!run || run.automationId !== params.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action } = await req.json();
  if (action !== "remove" && action !== "advance") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const ok = action === "remove" ? await removeRunFromWorkflow(run.id) : await pushRunToNextStep(run.id);
  if (!ok) {
    return NextResponse.json({ error: "Couldn't perform that action — the contact may have already moved on." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
