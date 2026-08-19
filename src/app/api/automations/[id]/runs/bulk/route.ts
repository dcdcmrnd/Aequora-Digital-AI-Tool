import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { pushRunToNextStep, removeRunFromWorkflow } from "@/lib/automation/engine";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

// This is a per-request chunk size, not a hard ceiling on a selection --
// useBulkRunAction on the client splits a larger "select all" into
// multiple sequential requests of this size, so every selected contact
// actually gets processed instead of the request either rejecting outright
// or (as it used to) silently processing only the first N with no way to
// reach the rest.
// Sized for the worst case, not the average: every run in the chunk sitting
// at a Send Email step. Gmail sends are now globally paced to ~1/second
// (see throttleGmailSend in lib/gmail.ts) to avoid tripping its per-user
// quota, so an all-email chunk takes roughly MAX_RUNS_PER_REQUEST seconds --
// this needs to stay comfortably under maxDuration below, or the request
// gets killed mid-batch and the un-run remainder looks like a stuck error
// instead of just "still going."
// Kept in sync with BULK_RUN_CHUNK_SIZE in useAutomations.ts, which chunks
// a larger selection into requests of this size (can't import a shared
// constant here -- Next.js route files only allow a fixed set of named
// exports, route handlers and config options, nothing else).
const MAX_RUNS_PER_REQUEST = 40;
const RUN_CONCURRENCY = 5;

// "Push to Next Step" can run a real step (send an email, etc.) per contact --
// same reasoning as resume-automations' cron: bounded concurrency instead of
// firing all of them at once, and an explicit budget since a chunk of 200
// heavier steps could otherwise run past Vercel's default limit.
export const maxDuration = 60;

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

  const results = await mapWithConcurrency(owned, RUN_CONCURRENCY, (run) =>
    action === "remove" ? removeRunFromWorkflow(run.id) : pushRunToNextStep(run.id),
  );

  return NextResponse.json({ success: true, count: results.filter(Boolean).length });
}
