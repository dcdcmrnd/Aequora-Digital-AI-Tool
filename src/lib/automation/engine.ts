import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { DISPLAY_TIMEZONE } from "@/lib/utils";
import { runAiPrompt } from "@/lib/ai";
import { verifyAndCacheForContacts } from "@/lib/emailVerification";
import { sendEmail } from "@/lib/gmail";
import { createNotification } from "@/lib/activity";
import { formatDailyTime, formatEventDateTime, formatWeekdayTime, getNextTimeOccurrenceUtc, getNextWeekdayOccurrenceUtc, zonedDateTimeToUtc } from "@/lib/utils/schedule";
import { applyMergeTags, contactMergeValues, customValueMergeValues, flattenForMergeTags } from "./mergeTags";
import type {
  AutomationEdge,
  AutomationFlow,
  AutomationNode,
  ConditionCombinator,
  ConditionRule,
  ContactTextField,
  TriggerType,
  WaitUnit,
} from "./types";
import { CONTACT_TEXT_FIELDS } from "./types";

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_ENROLLMENT_DEPTH = 10;

interface TriggerEvent {
  triggerType: TriggerType;
  /** Absent for triggers with no associated contact (e.g. task_completed, note_added). */
  contactId?: string;
  /** Required for triggerType "tag_added" — the tag that was just added. */
  tag?: string;
  /** Required for triggerType "opportunity_stage_changed"/"opportunity_won"/"opportunity_lost" — the stage/status it moved into. */
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

function sameTag(a?: string, b?: string): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function triggerMatches(triggerNode: AutomationNode, event: TriggerEvent): boolean {
  const data = triggerNode.data as { triggerType?: TriggerType; tag?: string; stageId?: string };
  if (data.triggerType !== event.triggerType) return false;
  if (event.triggerType === "tag_added" && !sameTag(data.tag, event.tag)) return false;
  if (event.triggerType === "opportunity_stage_changed" && data.stageId !== event.stageId) return false;
  return true;
}

const TRIGGER_DETAIL_LABELS: Partial<Record<TriggerType, string>> = {
  opportunity_created: "Opportunity created",
  opportunity_won: "Opportunity marked won",
  opportunity_lost: "Opportunity marked lost",
  task_completed: "Task completed",
  note_added: "Note added",
  email_opened: "Email opened",
};

function durationMs(amount: number, unit: WaitUnit): number {
  const unitMs = { minutes: 60_000, hours: 60 * 60_000, days: 24 * 60 * 60_000 };
  return amount * (unitMs[unit] ?? unitMs.hours);
}

function triggerDetail(event: TriggerEvent): string {
  if (event.triggerType === "tag_added") return `Tag added: ${event.tag ?? ""}`;
  if (event.triggerType === "opportunity_stage_changed") return "Opportunity moved stage";
  return TRIGGER_DETAIL_LABELS[event.triggerType] ?? "Contact created";
}

/** Records one step of a run's path through the flow, for the execution log UI. */
async function logStep(
  runId: string,
  nodeId: string,
  nodeType: string,
  status: "success" | "error" | "waiting",
  detail?: string,
): Promise<void> {
  await prisma.automationRunStep.create({ data: { runId, nodeId, nodeType, status, detail } });
}

/** The contact's most-recent open opportunity — the implicit single-opportunity-per-contact model used throughout this engine. */
async function findOpenOpportunityForContact(contactId: string) {
  return prisma.opportunity.findFirst({ where: { contactId, status: "open" }, orderBy: { createdAt: "desc" } });
}

/**
 * Best-effort round robin: rotates through `userIds` based on how many times this node has
 * already succeeded. Not perfectly race-free under true concurrency, but self-corrects on the
 * next run and needs no extra table/column — acceptable for a small internal team.
 */
async function pickRoundRobin(nodeId: string, userIds: string[]): Promise<string | undefined> {
  if (userIds.length === 0) return undefined;
  const count = await prisma.automationRunStep.count({ where: { nodeId, status: "success" } });
  return userIds[count % userIds.length];
}

function resolveAssignee(
  mode: string | undefined,
  singleUserId: string | undefined,
  roundRobinUserIds: string[] | undefined,
  nodeId: string,
): Promise<string | undefined> {
  if (mode === "round_robin") return pickRoundRobin(nodeId, roundRobinUserIds ?? []);
  if (mode === "single") return Promise.resolve(singleUserId || undefined);
  return Promise.resolve(undefined);
}

/** Evaluates a single condition predicate against a run's contact. Shared by both the legacy single-predicate path and the compound rules path. */
async function evaluateConditionRule(rule: ConditionRule, run: { id: string; contactId: string | null; createdAt: Date }): Promise<{ result: boolean; detail: string }> {
  if (rule.conditionType === "has_tag") {
    const contact = run.contactId ? await prisma.contact.findUnique({ where: { id: run.contactId } }) : null;
    const tags = contact ? (JSON.parse(contact.tags) as string[]) : [];
    const result = !!rule.tag && tags.some((t) => sameTag(t, rule.tag));
    return { result, detail: `Contact has tag "${rule.tag ?? ""}"` };
  }
  if (rule.conditionType === "opportunity_at_stage") {
    const opportunity = run.contactId ? await findOpenOpportunityForContact(run.contactId) : null;
    const result = !!rule.stageId && opportunity?.stageId === rule.stageId;
    return { result, detail: "Opportunity at configured stage" };
  }
  if (rule.conditionType === "days_since_entered") {
    const days = rule.days ?? 0;
    const elapsedMs = Date.now() - run.createdAt.getTime();
    const result = days > 0 && elapsedMs >= days * 24 * 60 * 60 * 1000;
    return { result, detail: `${days} day${days === 1 ? "" : "s"} since entering the workflow` };
  }
  if (rule.conditionType === "field_comparison") {
    const contact = run.contactId ? await prisma.contact.findUnique({ where: { id: run.contactId } }) : null;
    const field = rule.field as ContactTextField | undefined;
    const raw = contact && field && CONTACT_TEXT_FIELDS.includes(field) ? ((contact as unknown as Record<string, string | null>)[field] ?? "") : "";
    const actual = raw.trim();
    const expected = (rule.value ?? "").trim();
    let result: boolean;
    switch (rule.operator) {
      case "not_equals": result = actual.toLowerCase() !== expected.toLowerCase(); break;
      case "contains": result = actual.toLowerCase().includes(expected.toLowerCase()); break;
      case "is_empty": result = actual === ""; break;
      case "is_not_empty": result = actual !== ""; break;
      default: result = actual.toLowerCase() === expected.toLowerCase();
    }
    return { result, detail: `Contact ${field ?? "field"} ${rule.operator ?? "equals"} "${expected}"` };
  }
  // "email_opened" (also the fallback for older runs saved before conditionType existed)
  const lastTracked = await prisma.emailTracking.findFirst({ where: { runId: run.id }, orderBy: { createdAt: "desc" } });
  return { result: !!lastTracked?.openedAt, detail: "Email was opened" };
}

const ACTIVE_RUN_STATUSES = ["running", "waiting"];
const TERMINAL_RUN_STATUSES = ["completed", "error", "cancelled"];

/**
 * Applies an automation's entry-control settings for one contact:
 * - allowMultipleEntries=false blocks a new run while one is already active
 *   (running/waiting) for this contact in this automation.
 * - allowReentry=false blocks a new run once this contact has ever finished
 *   a run here before (completed/error/cancelled), regardless of whether
 *   they're currently active — for workflows meant to reach a contact once.
 * Both default true, so automations created before these settings existed
 * keep their original behavior (every trigger fire enrolls, no dedup).
 */
async function canEnterAutomation(
  automation: { id: string; allowMultipleEntries: boolean; allowReentry: boolean },
  contactId: string,
): Promise<boolean> {
  if (automation.allowMultipleEntries && automation.allowReentry) return true;

  const priorRuns = await prisma.automationRun.findMany({
    where: { automationId: automation.id, contactId },
    select: { status: true },
  });

  if (!automation.allowMultipleEntries && priorRuns.some((r) => ACTIVE_RUN_STATUSES.includes(r.status))) return false;
  if (!automation.allowReentry && priorRuns.some((r) => TERMINAL_RUN_STATUSES.includes(r.status))) return false;
  return true;
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

      if (event.contactId && !(await canEnterAutomation(automation, event.contactId))) continue;

      const run = await prisma.automationRun.create({
        data: {
          automationId: automation.id,
          contactId: event.contactId ?? null,
          status: "running",
          currentNodeId: firstNodeId,
        },
      });

      await logStep(run.id, triggerNode.id, triggerNode.type, "success", triggerDetail(event));
      await runLoop(run.id, flow, firstNodeId);
    }
  } catch {
    // Never let automation firing break the triggering request.
  }
}

/**
 * Manually enrolls a contact into an automation's flow, skipping trigger
 * matching entirely (e.g. a bulk "Add to Workflow" action from the Contacts
 * list). Returns false if the automation's entry-control settings block it
 * for this contact right now, or if the trigger has no action attached yet.
 */
export async function enrollContactInAutomation(automationId: string, contactId: string, depth = 0): Promise<boolean> {
  if (depth > MAX_ENROLLMENT_DEPTH) return false;

  const automation = await prisma.automation.findUnique({ where: { id: automationId } });
  if (!automation) return false;

  if (!(await canEnterAutomation(automation, contactId))) return false;

  const flow = parseFlow(automation.flow);
  const triggerNode = flow.nodes.find((n) => n.type === "trigger");
  if (!triggerNode) return false;

  const firstNodeId = nextNodeId(flow, triggerNode.id);
  if (!firstNodeId) return false;

  const run = await prisma.automationRun.create({
    data: { automationId, contactId, status: "running", currentNodeId: firstNodeId },
  });

  await logStep(run.id, triggerNode.id, triggerNode.type, "success", "Manually added to workflow");
  await runLoop(run.id, flow, firstNodeId, depth);
  return true;
}

interface WebhookTriggerConfig {
  contactField?: string;
  createContact?: boolean;
  nameField?: string;
  phoneField?: string;
  companyField?: string;
}

/** Looks up (or optionally creates) the contact an inbound webhook payload refers to, per the trigger's field-mapping config. */
async function resolveWebhookContact(
  systemUserId: string,
  payload: Record<string, unknown>,
  config: WebhookTriggerConfig | undefined,
): Promise<string | undefined> {
  const emailField = config?.contactField?.trim() || "email";
  const rawEmail = payload[emailField];
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined;
  if (!email) return undefined;

  const existing = await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existing) return existing.id;
  if (!config?.createContact) return undefined;

  const pick = (field?: string) => {
    if (!field) return undefined;
    const value = payload[field.trim()];
    return typeof value === "string" ? value.trim() : undefined;
  };

  const contact = await prisma.contact.create({
    data: {
      name: pick(config.nameField) || email,
      email,
      phone: pick(config.phoneField) || undefined,
      company: pick(config.companyField) || undefined,
      createdById: systemUserId,
    },
  });
  return contact.id;
}

/**
 * Fires the single automation identified by a webhook secret (see
 * /api/automations/webhook/[secret]). Unlike runAutomationsForTrigger — which broadcasts an
 * event to every automation listening for a given trigger type — an inbound webhook URL is
 * scoped to exactly one automation by construction, so this looks up that one automation
 * directly rather than scanning all active automations for a match.
 */
export async function runInboundWebhook(secret: string, payload: Record<string, unknown>): Promise<"ok" | "not_found" | "no_action"> {
  const automation = await prisma.automation.findUnique({ where: { webhookSecret: secret } });
  if (!automation || !automation.isActive) return "not_found";

  const flow = parseFlow(automation.flow);
  const triggerNode = flow.nodes.find((n) => n.type === "trigger");
  const triggerData = triggerNode?.data as { triggerType?: TriggerType } & WebhookTriggerConfig | undefined;
  if (!triggerNode || triggerData?.triggerType !== "webhook_received") return "not_found";

  const firstNodeId = nextNodeId(flow, triggerNode.id);
  if (!firstNodeId) return "no_action"; // trigger configured but nothing attached yet

  const contactId = await resolveWebhookContact(automation.createdById, payload, triggerData);
  if (contactId && !(await canEnterAutomation(automation, contactId))) return "no_action";

  const run = await prisma.automationRun.create({
    data: {
      automationId: automation.id,
      contactId: contactId ?? null,
      status: "running",
      currentNodeId: firstNodeId,
      payload: JSON.stringify(payload),
    },
  });

  await logStep(run.id, triggerNode.id, triggerNode.type, "success", "Webhook received");
  await runLoop(run.id, flow, firstNodeId);
  return "ok";
}

/** Resumes a run paused at a "wait" node — called by the cron sweep or the open-tracking pixel. */
export async function resumeRun(runId: string): Promise<void> {
  try {
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
  } catch (err) {
    // A single bad run (corrupt flow JSON, a transient DB hiccup, etc.) must
    // never take the whole batch down with it -- the daily cron calls this
    // once per due run in a plain loop, so an uncaught throw here used to
    // propagate out of the route handler and abort every other run still
    // waiting behind it for that entire invocation. Since the failing run
    // stayed "waiting" and due, it would then fail the exact same way on
    // every subsequent cron run too, permanently starving everything queued
    // after it -- this is why waits kept silently not firing.
    console.error(`resumeRun failed for run ${runId}`, err);
    await prisma.automationRun
      .update({ where: { id: runId }, data: { status: "error", detail: err instanceof Error ? err.message : "Unknown error" } })
      .catch(() => {});
  }
}

/** Manually stops a contact's run — used by the "Remove from Workflow" action in the builder's per-step contact list. */
export async function removeRunFromWorkflow(runId: string): Promise<boolean> {
  const run = await prisma.automationRun.findUnique({ where: { id: runId } });
  if (!run) return false;

  await prisma.automationRun.update({
    where: { id: run.id },
    data: { status: "cancelled", waitUntil: null, waitToken: null },
  });
  await logStep(run.id, run.currentNodeId ?? "unknown", "manual", "success", "Removed from workflow manually");
  return true;
}

/**
 * Manually advances a contact past its current step — used by the "Push to
 * Next Step" action in the builder's per-step contact list. Unlike
 * `resumeRun` (which only resumes a genuine wait), this also works for a run
 * stuck in "error" status, letting someone unblock a contact past a failed
 * step (e.g. a webhook that 500'd) without waiting for a fix. Also covers
 * "running": that status is only ever meant to be held for the duration of
 * one runLoop call, but if the process handling it dies mid-step (a
 * serverless timeout, a crash) the DB update to "error"/"completed" never
 * lands and the run is orphaned there indefinitely — otherwise
 * unrecoverable, since nothing else ever revisits a "running" row.
 */
export async function pushRunToNextStep(runId: string, label = "Manually pushed to next step"): Promise<boolean> {
  const run = await prisma.automationRun.findUnique({ where: { id: runId } });
  if (!run || !run.currentNodeId) return false;
  if (!["waiting", "error", "running"].includes(run.status)) return false;

  const automation = await prisma.automation.findUnique({ where: { id: run.automationId } });
  if (!automation) return false;

  const flow = parseFlow(automation.flow);
  const next = nextNodeId(flow, run.currentNodeId);

  await prisma.automationRun.update({
    where: { id: run.id },
    data: { status: "running", waitUntil: null, waitToken: null, detail: null },
  });
  await logStep(run.id, run.currentNodeId, "manual", "success", label);

  if (!next) {
    await prisma.automationRun.update({ where: { id: run.id }, data: { status: "completed", currentNodeId: null } });
    return true;
  }

  await runLoop(run.id, flow, next);
  return true;
}

/** A "running" run is only ever meant to hold that status for the duration of one runLoop call — past this, it can only mean the process handling it died mid-step. */
const STALE_RUNNING_MS = 10 * 60_000;

/**
 * IDs of runs orphaned in "running" (see `pushRunToNextStep`'s doc comment)
 * across every automation — the daily cron sweep pushes each of these past
 * its last known step (bounded concurrency, same as its due-wait handling),
 * so a process dying mid-step doesn't leave a contact silently stuck until
 * someone happens to notice and manually push it.
 */
export async function findStuckRunIds(): Promise<string[]> {
  const staleRuns = await prisma.automationRun.findMany({
    where: { status: "running", currentNodeId: { not: null }, updatedAt: { lte: new Date(Date.now() - STALE_RUNNING_MS) } },
    select: { id: true },
  });
  return staleRuns.map((r) => r.id);
}

const OPPORTUNISTIC_SWEEP_MAX_ITEMS = 5;
const OPPORTUNISTIC_SWEEP_COOLDOWN_MS = 30_000;
let lastOpportunisticSweepAt = 0;

/**
 * Piggybacks a small, bounded pass of overdue automation work (due waits,
 * runs stuck in "running") onto ordinary app traffic — called from the
 * authenticated layout on every navigation. This project's Vercel plan caps
 * its cron to once a day, so relying on that alone leaves a due wait or a
 * stuck run sitting for up to 24 hours; real use of the app is a much
 * better proxy for "someone cares about this right now" than a fixed daily
 * tick. Deliberately awaited inline rather than fire-and-forget — a Vercel
 * serverless function isn't guaranteed to keep running background work once
 * its response is sent — so this stays capped small enough not to
 * noticeably slow a page load down. A backlog bigger than the cap just
 * drains a few more items on the next navigation instead of all at once;
 * the daily cron still exists as a backstop for when nobody's using the app.
 */
export async function maybeRunOpportunisticSweep(): Promise<void> {
  if (Date.now() - lastOpportunisticSweepAt < OPPORTUNISTIC_SWEEP_COOLDOWN_MS) return;
  lastOpportunisticSweepAt = Date.now();

  try {
    const dueWaits = await prisma.automationRun.findMany({
      where: { status: "waiting", waitUntil: { lte: new Date() } },
      select: { id: true },
      take: OPPORTUNISTIC_SWEEP_MAX_ITEMS,
    });
    for (const run of dueWaits) await resumeRun(run.id);

    const remaining = OPPORTUNISTIC_SWEEP_MAX_ITEMS - dueWaits.length;
    if (remaining > 0) {
      const stuckIds = (await findStuckRunIds()).slice(0, remaining);
      for (const runId of stuckIds) {
        try {
          await pushRunToNextStep(runId, "Automatically recovered — run was stuck mid-step");
        } catch (err) {
          console.error(`Opportunistic sweep failed to recover stuck run ${runId}`, err);
        }
      }
    }
  } catch (err) {
    // Must never break a page load -- this is a best-effort side effect of
    // navigating the app, not something any request actually depends on.
    console.error("Opportunistic automation sweep failed", err);
  }
}

async function runLoop(runId: string, flow: AutomationFlow, startNodeId: string, enrollmentDepth = 0): Promise<void> {
  const run = await prisma.automationRun.findUnique({ where: { id: runId } });
  if (!run) return;

  // Fallback creator/author for any record an automation creates on a human's behalf
  // (Task.creatorId / Note.authorId are required columns; there's no "system user").
  const automation = await prisma.automation.findUnique({ where: { id: run.automationId }, select: { createdById: true, name: true } });
  const systemUserId = automation?.createdById;

  // Merge tokens contributed by the run's own history rather than the contact record:
  // {{webhook.*}} from the inbound trigger's payload (if any), and {{http.<name>.*}} from
  // any earlier Webhook step in this same run that saved its response under a variable name.
  // Rebuilt fresh each time runLoop starts (including on resume), and extended in place below
  // whenever a later Webhook step captures a new response.
  let storedVariables: Record<string, Record<string, unknown>> = run.variables ? JSON.parse(run.variables) : {};
  const dynamicValues: Record<string, string> = {
    ...(await customValueMergeValues()),
    ...(run.payload ? flattenForMergeTags("webhook", JSON.parse(run.payload)) : {}),
    ...Object.fromEntries(Object.entries(storedVariables).flatMap(([name, value]) => Object.entries(flattenForMergeTags(`http.${name}`, value)))),
  };

  let currentNodeId: string | undefined = startNodeId;

  try {
    while (currentNodeId) {
      const node = findNode(flow, currentNodeId);
      if (!node) break;

      if (node.type === "send_email") {
        try {
          if (!run.contactId) throw new Error("No contact for this run");
          const contact = await prisma.contact.findUnique({ where: { id: run.contactId } });
          if (!contact?.email) throw new Error("Contact has no email address");

          if (contact.emailBounced) {
            await logStep(run.id, node.id, node.type, "success", `Skipped — a previous email to ${contact.email} bounced`);
            currentNodeId = nextNodeId(flow, node.id);
            continue;
          }
          const verification = await verifyAndCacheForContacts(contact.email);
          if (verification === "invalid") {
            await logStep(run.id, node.id, node.type, "success", `Skipped — ${contact.email} failed verification`);
            currentNodeId = nextNodeId(flow, node.id);
            continue;
          }

          const data = node.data as { subject?: string; body?: string; cc?: string; fromEmail?: string };
          const mergeValues = { ...contactMergeValues(contact), ...dynamicValues };
          const subject = applyMergeTags(data.subject ?? "", mergeValues);
          const body = applyMergeTags(data.body ?? "", mergeValues);
          const cc = data.cc ? applyMergeTags(data.cc, mergeValues) : undefined;

          const additionalEmails = JSON.parse(contact.additionalEmails) as string[];
          const allRecipients = Array.from(new Set([contact.email, ...additionalEmails].filter(Boolean))) as string[];
          const to = allRecipients.join(", ");

          const trackingToken = crypto.randomBytes(16).toString("hex");
          await prisma.emailTracking.create({ data: { token: trackingToken, runId: run.id, contactId: contact.id } });
          const sendResult = await sendEmail({ to, subject, body, cc, fromEmail: data.fromEmail, trackingToken }, null);
          await prisma.emailTracking.update({
            where: { token: trackingToken },
            data: { gmailMessageId: sendResult.id ?? undefined, gmailThreadId: sendResult.threadId ?? undefined },
          });

          await logStep(run.id, node.id, node.type, "success", `Sent to ${to}`);
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "add_tag") {
        try {
          if (run.contactId) {
            const contact = await prisma.contact.findUnique({ where: { id: run.contactId } });
            const data = node.data as { tag?: string };
            const tagToAdd = data.tag?.trim().toLowerCase();
            if (contact && tagToAdd) {
              const tags = JSON.parse(contact.tags) as string[];
              if (!tags.some((t) => sameTag(t, tagToAdd))) {
                tags.push(tagToAdd);
                await prisma.contact.update({ where: { id: contact.id }, data: { tags: JSON.stringify(tags) } });
              }
              await logStep(run.id, node.id, node.type, "success", `Tag added: ${tagToAdd}`);
            } else {
              await logStep(run.id, node.id, node.type, "success", "No tag configured");
            }
          } else {
            await logStep(run.id, node.id, node.type, "success", "No contact for this run");
          }
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "remove_tag") {
        try {
          if (run.contactId) {
            const contact = await prisma.contact.findUnique({ where: { id: run.contactId } });
            const data = node.data as { tag?: string };
            const tagToRemove = data.tag?.trim().toLowerCase();
            if (contact && tagToRemove) {
              const tags = JSON.parse(contact.tags) as string[];
              const nextTags = tags.filter((t) => !sameTag(t, tagToRemove));
              if (nextTags.length !== tags.length) {
                await prisma.contact.update({ where: { id: contact.id }, data: { tags: JSON.stringify(nextTags) } });
              }
              await logStep(run.id, node.id, node.type, "success", `Tag removed: ${tagToRemove}`);
            } else {
              await logStep(run.id, node.id, node.type, "success", "No tag configured");
            }
          } else {
            await logStep(run.id, node.id, node.type, "success", "No contact for this run");
          }
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "move_pipeline_stage") {
        try {
          const data = node.data as { stageId?: string };
          if (run.contactId && data.stageId) {
            const opportunity = await findOpenOpportunityForContact(run.contactId);
            if (opportunity) {
              await prisma.opportunity.update({ where: { id: opportunity.id }, data: { stageId: data.stageId } });
              await logStep(run.id, node.id, node.type, "success", "Opportunity moved to new stage");
            } else if (systemUserId) {
              // No opportunity yet for this contact — create one in the
              // target stage instead of silently no-op'ing, since "move to
              // stage" is how most workflows expect a contact to actually
              // land in the pipeline for the first time.
              const stage = await prisma.pipelineStage.findUnique({ where: { id: data.stageId } });
              if (stage) {
                const contact = await prisma.contact.findUnique({ where: { id: run.contactId } });
                const opportunityName = contact?.name ? `${contact.name}` : "New opportunity";
                await prisma.opportunity.create({
                  data: {
                    name: opportunityName,
                    contactId: run.contactId,
                    pipelineId: stage.pipelineId,
                    stageId: stage.id,
                    createdById: systemUserId,
                  },
                });
                await logStep(run.id, node.id, node.type, "success", "Created opportunity in this stage (none existed yet)");
              } else {
                await logStep(run.id, node.id, node.type, "error", "Configured stage no longer exists");
              }
            } else {
              await logStep(run.id, node.id, node.type, "success", "No open opportunity found for this contact");
            }
          } else {
            await logStep(run.id, node.id, node.type, "success", "No stage configured");
          }
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "set_event_date") {
        try {
          if (!run.contactId) {
            await logStep(run.id, node.id, node.type, "success", "No contact for this run");
          } else {
            const data = node.data as { value?: string; timezone?: string };
            const timezone = data.timezone || "America/New_York";
            // data.value is a <input type="datetime-local"> string (e.g.
            // "2026-03-05T14:00") with no timezone of its own -- interpreted
            // as whatever the configured timezone means by that wall-clock
            // time, not the server's (UTC on Vercel) or the browser's.
            const eventDate = data.value ? zonedDateTimeToUtc(data.value, timezone) : null;
            if (!eventDate || Number.isNaN(eventDate.getTime())) throw new Error("No event date configured for this step");

            await prisma.contact.update({ where: { id: run.contactId }, data: { eventDate } });
            await logStep(run.id, node.id, node.type, "success", `Event date set to ${formatEventDateTime(eventDate, timezone)}`);
          }
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "condition") {
        try {
          const data = node.data as {
            conditionType?: string; tag?: string; stageId?: string; days?: number;
            rules?: ConditionRule[]; combinator?: ConditionCombinator;
          };
          // Legacy flows (saved before compound rules existed) have flat fields and no
          // `rules` array — wrap them into a single implicit rule so evaluation and the
          // execution-log wording stay identical to before for every existing automation.
          const rules: ConditionRule[] = data.rules?.length
            ? data.rules
            : [{ id: "legacy", conditionType: (data.conditionType as ConditionRule["conditionType"]) ?? "email_opened", tag: data.tag, stageId: data.stageId, days: data.days }];

          const evaluated = await Promise.all(rules.map((rule) => evaluateConditionRule(rule, run)));
          const result = rules.length > 1 && data.combinator === "OR"
            ? evaluated.some((e) => e.result)
            : evaluated.every((e) => e.result);

          const detail = rules.length === 1
            ? `${evaluated[0].detail} — ${evaluated[0].result ? "Yes" : "No"}`
            : `${evaluated.map((e) => `${e.detail} (${e.result ? "Yes" : "No"})`).join(data.combinator === "OR" ? " OR " : " AND ")} — ${result ? "Yes" : "No"}`;

          await logStep(run.id, node.id, node.type, "success", detail);
          currentNodeId = nextNodeId(flow, node.id, result ? "yes" : "no");
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        continue;
      }

      if (node.type === "split") {
        // Independently random per contact per pass through this node —
        // matches GHL's A/B split semantics (a testing tool, not something
        // that needs to be stable/repeatable for the same contact).
        const data = node.data as { splitPercent?: number };
        const splitPercent = data.splitPercent ?? 50;
        const wentA = Math.random() * 100 < splitPercent;
        await logStep(run.id, node.id, node.type, "success", `Split ${splitPercent}/${100 - splitPercent} — went ${wentA ? "A" : "B"}`);
        currentNodeId = nextNodeId(flow, node.id, wentA ? "yes" : "no");
        continue;
      }

      if (node.type === "wait") {
        const data = node.data as {
          mode?: string; amount?: number; unit?: WaitUnit; condition?: string;
          dayOfWeek?: number | null; time?: string; timezone?: string; direction?: "before" | "after";
          pastDueAction?: "continue" | "end";
        };

        if (data.mode === "event") {
          try {
            const contact = run.contactId ? await prisma.contact.findUnique({ where: { id: run.contactId } }) : null;
            if (!contact?.eventDate) throw new Error("Contact has no event date set — add a \"Set Event Date\" step before this wait");

            const offsetMs = durationMs(data.amount ?? 1, data.unit ?? "days");
            const direction = data.direction === "after" ? "after" : "before";
            const target = new Date(contact.eventDate.getTime() + (direction === "before" ? -offsetMs : offsetMs));

            if (target.getTime() <= Date.now()) {
              // The target moment already passed (e.g. enrolled late, or the event is close) --
              // there's nothing left to wait for, so what happens next is whichever the step was
              // configured for: skip ahead (default, preserves pre-existing automations that
              // predate this option) or stop the run here entirely.
              if (data.pastDueAction === "end") {
                await logStep(run.id, node.id, node.type, "success", `Event wait target (${direction} event date) already passed — ending workflow`);
                break;
              }
              await logStep(run.id, node.id, node.type, "success", `Event wait target (${direction} event date) already passed — continuing immediately`);
              currentNodeId = nextNodeId(flow, node.id);
              continue;
            }

            await prisma.automationRun.update({
              where: { id: run.id },
              data: { status: "waiting", currentNodeId: node.id, waitUntil: target },
            });
            await logStep(run.id, node.id, node.type, "waiting", `Waiting until ${target.toLocaleString("en-US", { timeZone: DISPLAY_TIMEZONE })} (${data.amount ?? 1} ${data.unit ?? "days"} ${direction} event date)`);
          } catch (err) {
            await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
            throw err;
          }
          return; // pause here until resumed (unless we already continued above)
        } else if (data.mode === "condition") {
          const lastTracked = await prisma.emailTracking.findFirst({
            where: { runId: run.id },
            orderBy: { createdAt: "desc" },
          });
          await prisma.automationRun.update({
            where: { id: run.id },
            data: { status: "waiting", currentNodeId: node.id, waitToken: lastTracked?.token ?? null },
          });
          await logStep(run.id, node.id, node.type, "waiting", "Waiting for email to be opened");
        } else if (data.mode === "schedule") {
          const [hourStr, minuteStr] = (data.time ?? "09:00").split(":");
          const hour = Number(hourStr) || 0;
          const minute = Number(minuteStr) || 0;
          const timezone = data.timezone || "America/New_York";
          // dayOfWeek === null means "Any day" — wait for the next occurrence
          // of the time itself instead of pinning a specific weekday.
          // undefined (nodes configured before this option existed) keeps the
          // original Monday default so existing automations don't change.
          let waitUntil: Date;
          let waitLabel: string;
          if (data.dayOfWeek === null) {
            waitUntil = getNextTimeOccurrenceUtc(hour, minute, timezone);
            waitLabel = formatDailyTime(hour, minute, timezone);
          } else {
            const dayOfWeek = data.dayOfWeek ?? 1;
            waitUntil = getNextWeekdayOccurrenceUtc(dayOfWeek, hour, minute, timezone);
            waitLabel = formatWeekdayTime(dayOfWeek, hour, minute, timezone);
          }
          await prisma.automationRun.update({
            where: { id: run.id },
            data: { status: "waiting", currentNodeId: node.id, waitUntil },
          });
          await logStep(run.id, node.id, node.type, "waiting", `Waiting until ${waitLabel}`);
        } else {
          const ms = durationMs(data.amount ?? 1, data.unit ?? "hours");
          await prisma.automationRun.update({
            where: { id: run.id },
            data: { status: "waiting", currentNodeId: node.id, waitUntil: new Date(Date.now() + ms) },
          });
          await logStep(run.id, node.id, node.type, "waiting", `Waiting ${data.amount ?? 1} ${data.unit ?? "hours"}`);
        }
        return; // pause here until resumed
      }

      if (node.type === "create_task") {
        try {
          const data = node.data as {
            projectId?: string; title?: string; description?: string; priority?: string;
            dueDateOffsetDays?: number; assigneeMode?: string; assigneeId?: string; roundRobinUserIds?: string[];
          };
          if (!data.projectId) throw new Error("No project configured for this step");
          if (!systemUserId) throw new Error("Could not resolve a creator for this task");

          const contact = run.contactId ? await prisma.contact.findUnique({ where: { id: run.contactId } }) : null;
          const mergeValues = { ...(contact ? contactMergeValues(contact) : {}), ...dynamicValues };
          const title = applyMergeTags(data.title || "Untitled task", mergeValues);
          const description = data.description ? applyMergeTags(data.description, mergeValues) : undefined;
          const assigneeId = await resolveAssignee(data.assigneeMode, data.assigneeId, data.roundRobinUserIds, node.id);
          const dueDate = data.dueDateOffsetDays ? new Date(Date.now() + data.dueDateOffsetDays * 24 * 60 * 60 * 1000) : undefined;

          const task = await prisma.task.create({
            data: {
              title, description, projectId: data.projectId,
              priority: data.priority || "medium",
              creatorId: systemUserId,
              assigneeId: assigneeId || undefined,
              dueDate,
            },
          });
          await logStep(run.id, node.id, node.type, "success", `Created task "${task.title}"`);
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "create_note") {
        try {
          const data = node.data as { title?: string; content?: string; projectId?: string; categoryId?: string };
          if (!systemUserId) throw new Error("Could not resolve an author for this note");
          if (!data.title) throw new Error("No title configured for this step");

          const contact = run.contactId ? await prisma.contact.findUnique({ where: { id: run.contactId } }) : null;
          const mergeValues = { ...(contact ? contactMergeValues(contact) : {}), ...dynamicValues };
          const title = applyMergeTags(data.title, mergeValues);
          const content = data.content ? applyMergeTags(data.content, mergeValues) : "";

          const note = await prisma.note.create({
            data: { title, content, authorId: systemUserId, projectId: data.projectId || undefined, categoryId: data.categoryId || undefined },
          });
          await logStep(run.id, node.id, node.type, "success", `Created note "${note.title}"`);
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "ai_prompt") {
        try {
          if (!run.contactId) {
            await logStep(run.id, node.id, node.type, "success", "No contact for this run");
          } else {
            const data = node.data as { prompt?: string; field?: ContactTextField };
            if (!data.prompt) throw new Error("No prompt configured for this step");
            const field = data.field && CONTACT_TEXT_FIELDS.includes(data.field) ? data.field : "notes";

            const contact = await prisma.contact.findUnique({ where: { id: run.contactId } });
            const mergeValues = { ...(contact ? contactMergeValues(contact) : {}), ...dynamicValues };
            const prompt = applyMergeTags(data.prompt, mergeValues);

            const result = await runAiPrompt(prompt);
            await prisma.contact.update({ where: { id: run.contactId }, data: { [field]: result } });
            await logStep(run.id, node.id, node.type, "success", `AI wrote to ${field}`);
          }
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "create_opportunity") {
        try {
          if (!run.contactId) {
            await logStep(run.id, node.id, node.type, "success", "No contact for this run");
          } else {
            const data = node.data as { name?: string; value?: number; stageId?: string };
            if (!data.stageId) throw new Error("No stage configured for this step");
            if (!systemUserId) throw new Error("Could not resolve a creator for this opportunity");

            const stage = await prisma.pipelineStage.findUnique({ where: { id: data.stageId } });
            if (!stage) throw new Error("Configured stage no longer exists");

            const contact = await prisma.contact.findUnique({ where: { id: run.contactId } });
            const mergeValues = { ...(contact ? contactMergeValues(contact) : {}), ...dynamicValues };
            const name = applyMergeTags(data.name || contact?.name || "New opportunity", mergeValues);

            const opportunity = await prisma.opportunity.create({
              data: {
                name, value: data.value ?? undefined, contactId: run.contactId,
                pipelineId: stage.pipelineId, stageId: stage.id, createdById: systemUserId,
              },
            });
            await logStep(run.id, node.id, node.type, "success", `Created opportunity "${opportunity.name}"`);
          }
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "update_contact_field") {
        try {
          if (!run.contactId) {
            await logStep(run.id, node.id, node.type, "success", "No contact for this run");
          } else {
            const data = node.data as { field?: ContactTextField; value?: string };
            if (!data.field || !CONTACT_TEXT_FIELDS.includes(data.field)) throw new Error("No field configured for this step");

            const contact = await prisma.contact.findUnique({ where: { id: run.contactId } });
            const mergeValues = { ...(contact ? contactMergeValues(contact) : {}), ...dynamicValues };
            const value = applyMergeTags(data.value ?? "", mergeValues);

            await prisma.contact.update({ where: { id: run.contactId }, data: { [data.field]: value } });
            await logStep(run.id, node.id, node.type, "success", `Set ${data.field} to "${value}"`);
          }
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "update_opportunity") {
        try {
          if (!run.contactId) {
            await logStep(run.id, node.id, node.type, "success", "No contact for this run");
          } else {
            const opportunity = await findOpenOpportunityForContact(run.contactId);
            if (!opportunity) {
              await logStep(run.id, node.id, node.type, "success", "No open opportunity found for this contact");
            } else {
              const data = node.data as { status?: string; value?: number };
              // Intentionally does not re-fire opportunity_won/lost/stage_changed triggers —
              // same (pre-existing) behavior as move_pipeline_stage, to avoid two automations
              // that react to each other's changes looping indefinitely.
              await prisma.opportunity.update({
                where: { id: opportunity.id },
                data: { ...(data.status !== undefined && { status: data.status }), ...(data.value !== undefined && { value: data.value }) },
              });
              await logStep(run.id, node.id, node.type, "success", "Opportunity updated");
            }
          }
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "assign_contact_to_user") {
        try {
          if (!run.contactId) {
            await logStep(run.id, node.id, node.type, "success", "No contact for this run");
          } else {
            const data = node.data as { mode?: string; assigneeId?: string; roundRobinUserIds?: string[] };
            const assigneeId = await resolveAssignee(data.mode, data.assigneeId, data.roundRobinUserIds, node.id);
            if (!assigneeId) {
              await logStep(run.id, node.id, node.type, "success", "No assignee configured");
            } else {
              await prisma.contact.update({ where: { id: run.contactId }, data: { assignedToId: assigneeId } });
              await logStep(run.id, node.id, node.type, "success", "Contact assigned");
            }
          }
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "send_notification") {
        try {
          const data = node.data as { recipientMode?: string; recipientId?: string; roundRobinUserIds?: string[]; title?: string; body?: string };
          const recipientId = await resolveAssignee(data.recipientMode, data.recipientId, data.roundRobinUserIds, node.id);
          if (!recipientId) throw new Error("No recipient configured for this step");

          const contact = run.contactId ? await prisma.contact.findUnique({ where: { id: run.contactId } }) : null;
          const mergeValues = { ...(contact ? contactMergeValues(contact) : {}), ...dynamicValues };
          const title = applyMergeTags(data.title || "Automation notification", mergeValues);
          const body = applyMergeTags(data.body || "", mergeValues);

          await createNotification({
            userId: recipientId, type: "automation", title, body,
            entityType: "automation", entityId: run.automationId,
          });
          await logStep(run.id, node.id, node.type, "success", `Notified ${recipientId}`);
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "webhook") {
        try {
          const data = node.data as {
            url?: string;
            method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
            extraFields?: { key: string; value: string }[];
            headers?: { key: string; value: string }[];
            authType?: "none" | "bearer" | "basic" | "header";
            authToken?: string;
            authUsername?: string;
            authPassword?: string;
            authHeaderName?: string;
            authHeaderValue?: string;
            bodyMode?: "auto" | "raw";
            rawBody?: string;
            responseVariable?: string;
          };
          if (!data.url) throw new Error("No URL configured for this step");

          const contact = run.contactId ? await prisma.contact.findUnique({ where: { id: run.contactId } }) : null;
          const mergeValues = { ...(contact ? contactMergeValues(contact) : {}), ...dynamicValues };
          const method = data.method || "POST";
          const url = applyMergeTags(data.url, mergeValues);
          const hasBody = method === "POST" || method === "PUT" || method === "PATCH";

          const headers: Record<string, string> = {};
          if (hasBody) headers["Content-Type"] = "application/json";
          for (const h of data.headers ?? []) {
            if (h.key) headers[h.key] = applyMergeTags(h.value ?? "", mergeValues);
          }
          if (data.authType === "bearer" && data.authToken) {
            headers["Authorization"] = `Bearer ${applyMergeTags(data.authToken, mergeValues)}`;
          } else if (data.authType === "basic" && data.authUsername) {
            const user = applyMergeTags(data.authUsername, mergeValues);
            const pass = applyMergeTags(data.authPassword ?? "", mergeValues);
            headers["Authorization"] = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
          } else if (data.authType === "header" && data.authHeaderName) {
            headers[data.authHeaderName] = applyMergeTags(data.authHeaderValue ?? "", mergeValues);
          }

          let body: string | undefined;
          if (hasBody) {
            if (data.bodyMode === "raw") {
              body = applyMergeTags(data.rawBody ?? "", mergeValues);
            } else {
              const extra: Record<string, string> = {};
              for (const field of data.extraFields ?? []) {
                if (field.key) extra[field.key] = applyMergeTags(field.value ?? "", mergeValues);
              }
              body = JSON.stringify({
                automationId: run.automationId,
                automationName: automation?.name ?? "",
                runId: run.id,
                triggeredAt: new Date().toISOString(),
                contact: contact ? { id: contact.id, name: contact.name, email: contact.email } : null,
                extra,
              });
            }
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
          let responseText = "";
          try {
            const res = await fetch(url, { method, headers, body, signal: controller.signal });
            responseText = await res.text().catch(() => "");
            if (!res.ok) throw new Error(`Webhook responded with ${res.status}${responseText ? `: ${responseText.slice(0, 200)}` : ""}`);
          } finally {
            clearTimeout(timeout);
          }

          let detail = `${method} ${url}`;
          if (data.responseVariable?.trim()) {
            const varName = data.responseVariable.trim();
            let parsed: unknown;
            try {
              parsed = responseText ? JSON.parse(responseText) : {};
            } catch {
              parsed = { value: responseText };
            }
            const varObj = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { value: parsed };
            storedVariables = { ...storedVariables, [varName]: varObj };
            await prisma.automationRun.update({ where: { id: run.id }, data: { variables: JSON.stringify(storedVariables) } });
            Object.assign(dynamicValues, flattenForMergeTags(`http.${varName}`, varObj));
            detail += ` → saved response as "${varName}"`;
          }
          await logStep(run.id, node.id, node.type, "success", detail);
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "enroll_in_automation") {
        try {
          const data = node.data as { automationId?: string };
          if (!data.automationId) throw new Error("No automation configured for this step");
          if (data.automationId === run.automationId) throw new Error("Cannot enroll a workflow into itself");
          if (!run.contactId) {
            await logStep(run.id, node.id, node.type, "success", "No contact for this run");
          } else {
            await enrollContactInAutomation(data.automationId, run.contactId, enrollmentDepth + 1);
            await logStep(run.id, node.id, node.type, "success", "Enrolled in another automation");
          }
        } catch (err) {
          await logStep(run.id, node.id, node.type, "error", err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
        currentNodeId = nextNodeId(flow, node.id);
        continue;
      }

      if (node.type === "end_workflow") {
        await logStep(run.id, node.id, node.type, "success", "Workflow ended");
        break;
      }

      await logStep(run.id, node.id, node.type, "error", "Unknown node type");
      break;
    }

    await prisma.automationRun.update({ where: { id: run.id }, data: { status: "completed", currentNodeId: null } });
  } catch (err) {
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "error", detail: err instanceof Error ? err.message : "Unknown error" },
    });
  }
}
