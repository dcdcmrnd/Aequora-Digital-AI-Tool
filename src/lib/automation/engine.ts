import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail";
import type { AutomationEdge, AutomationFlow, AutomationNode, TriggerType, WaitUnit } from "./types";

interface TriggerEvent {
  triggerType: TriggerType;
  contactId: string;
  /** Required for triggerType "tag_added" — the tag that was just added. */
  tag?: string;
  /** Required for triggerType "opportunity_stage_changed" — the stage it moved into. */
  stageId?: string;
}

function parseFlow(flowJson: string): AutomationFlow {
  try {
    const parsed = JSON.parse(flowJson);
    return { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [] };
  } catch {
    return { nodes: [], edges: [] };
  }
}

function findNode(flow: AutomationFlow, id: string): AutomationNode | undefined {
  return flow.nodes.find((n) => n.id === id);
}

function nextNodeId(flow: AutomationFlow, fromNodeId: string, sourceHandle?: string): string | undefined {
  const edge = flow.edges.find(
    (e: AutomationEdge) => e.source === fromNodeId && (sourceHandle === undefined || e.sourceHandle === sourceHandle),
  );
  return edge?.target;
}

function triggerMatches(triggerNode: AutomationNode, event: TriggerEvent): boolean {
  const data = triggerNode.data as { triggerType?: TriggerType; tag?: string; stageId?: string };
  if (data.triggerType !== event.triggerType) return false;
  if (event.triggerType === "tag_added" && data.tag !== event.tag) return false;
  if (event.triggerType === "opportunity_stage_changed" && data.stageId !== event.stageId) return false;
  return true;
}

function durationMs(amount: number, unit: WaitUnit): number {
  const unitMs = { minutes: 60_000, hours: 60 * 60_000, days: 24 * 60 * 60_000 };
  return amount * (unitMs[unit] ?? unitMs.hours);
}

/** Finds active automations whose trigger matches the fired event and starts a run for each. */
export async function runAutomationsForTrigger(event: TriggerEvent): Promise<void> {
  try {
    const automations = await prisma.automation.findMany({ where: { isActive: true } });

    for (const automation of automations) {
      const flow = parseFlow(automation.flow);
      const triggerNode = flow.nodes.find((n) => n.type === "trigger");
      if (!triggerNode || !triggerMatches(triggerNode, event)) continue;

      const firstNodeId = nextNodeId(flow, triggerNode.id);
      if (!firstNodeId) continue; // trigger configured but nothing attached yet

      const run = await prisma.automationRun.create({
        data: {
          automationId: automation.id,
          contactId: event.contactId,
          status: "running",
          currentNodeId: firstNodeId,
        },
      });

      await runLoop(run.id, flow, firstNodeId);
    }
  } catch {
    // Never let automation firing break the triggering request.
  }
}

/** Resumes a run paused at a "wait" node — called by the cron sweep or the open-tracking pixel. */
export async function resumeRun(runId: string): Promise<void> {
  const run = await prisma.automationRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "waiting" || !run.currentNodeId) return;

  const automation = await prisma.automation.findUnique({ where: { id: run.automationId } });
  if (!automation) return;

  const flow = parseFlow(automation.flow);
  const next = nextNodeId(flow, run.currentNodeId);

  await prisma.automationRun.update({
    where: { id: run.id },
    data: { status: "running", waitUntil: null, waitToken: null },
  });

  if (!next) {
    await prisma.automationRun.update({ where: { id: run.id }, data: { status: "completed", currentNodeId: null } });
    return;
  }

  await runLoop(run.id, flow, next);
}

async function runLoop(runId: string, flow: AutomationFlow, startNodeId: string): Promise<void> {
  const run = await prisma.automationRun.findUnique({ where: { id: runId } });
  if (!run) return;

  let currentNodeId: string | undefined = startNodeId;

  try {
    while (currentNodeId) {
      const node = findNode(flow, currentNodeId);
      if (!node) break;

      if (node.type === "send_email") {
        if (!run.contactId) throw new Error("No contact for this run");
        const contact = await prisma.contact.findUnique({ where: { id: run.contactId } });
        if (!contact?.email) throw new Error("Contact has no email address");

        const data = node.data as { subject?: string; body?: string };
        const trackingToken = crypto.randomBytes(16).toString("hex");
        await prisma.automationEmailTracking.create({ data: { token: trackingToken, runId: run.id } });
        await sendEmail({ to: contact.email, subject: data.subject ?? "", body: data.body ?? "", trackingToken });

        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "add_tag") {
        if (run.contactId) {
          const contact = await prisma.contact.findUnique({ where: { id: run.contactId } });
          const data = node.data as { tag?: string };
          if (contact && data.tag) {
            const tags = JSON.parse(contact.tags) as string[];
            if (!tags.includes(data.tag)) {
              tags.push(data.tag);
              await prisma.contact.update({ where: { id: contact.id }, data: { tags: JSON.stringify(tags) } });
            }
          }
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "move_pipeline_stage") {
        const data = node.data as { stageId?: string };
        if (run.contactId && data.stageId) {
          const opportunity = await prisma.opportunity.findFirst({
            where: { contactId: run.contactId, status: "open" },
            orderBy: { createdAt: "desc" },
          });
          if (opportunity) {
            await prisma.opportunity.update({ where: { id: opportunity.id }, data: { stageId: data.stageId } });
          }
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "condition") {
        // v1: single supported check — was the most recent tracked email on this run opened?
        const lastTracked = await prisma.automationEmailTracking.findFirst({
          where: { runId: run.id },
          orderBy: { createdAt: "desc" },
        });
        const opened = !!lastTracked?.openedAt;
        currentNodeId = nextNodeId(flow, node.id, opened ? "yes" : "no");
        continue;
      }

      if (node.type === "wait") {
        const data = node.data as { mode?: string; amount?: number; unit?: WaitUnit; condition?: string };

        if (data.mode === "condition") {
          const lastTracked = await prisma.automationEmailTracking.findFirst({
            where: { runId: run.id },
            orderBy: { createdAt: "desc" },
          });
          await prisma.automationRun.update({
            where: { id: run.id },
            data: { status: "waiting", currentNodeId: node.id, waitToken: lastTracked?.token ?? null },
          });
        } else {
          const ms = durationMs(data.amount ?? 1, data.unit ?? "hours");
          await prisma.automationRun.update({
            where: { id: run.id },
            data: { status: "waiting", currentNodeId: node.id, waitUntil: new Date(Date.now() + ms) },
          });
        }
        return; // pause here until resumed
      }

      break; // unknown node type
    }

    await prisma.automationRun.update({ where: { id: run.id }, data: { status: "completed", currentNodeId: null } });
  } catch (err) {
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "error", detail: err instanceof Error ? err.message : "Unknown error" },
    });
  }
}
