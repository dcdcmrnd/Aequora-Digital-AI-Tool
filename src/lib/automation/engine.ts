import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail";
import type { TriggerType } from "./types";

interface TriggerEvent {
  triggerType: TriggerType;
  contactId: string;
  /** Required for triggerType "tag_added" — the tag that was just added. */
  tag?: string;
  /** Required for triggerType "opportunity_stage_changed" — the stage it moved into. */
  stageId?: string;
}

/**
 * Finds active automations matching the fired trigger and runs their
 * actions in order. Never throws — automation failures must not break the
 * request that triggered them (same contract as logActivity).
 */
export async function runAutomationsForTrigger(event: TriggerEvent): Promise<void> {
  try {
    const automations = await prisma.automation.findMany({
      where: { triggerType: event.triggerType, isActive: true },
      include: { actions: { orderBy: { order: "asc" } } },
    });

    for (const automation of automations) {
      const triggerConfig = JSON.parse(automation.triggerConfig) as Record<string, string>;
      if (event.triggerType === "tag_added" && triggerConfig.tag !== event.tag) continue;
      if (event.triggerType === "opportunity_stage_changed" && triggerConfig.stageId !== event.stageId) continue;

      await runAutomation(automation, event.contactId);
    }
  } catch {
    // Swallow — see doc comment above.
  }
}

async function runAutomation(
  automation: { id: string; actions: { order: number; actionType: string; config: string }[] },
  contactId: string,
): Promise<void> {
  try {
    for (const action of automation.actions) {
      const config = JSON.parse(action.config) as Record<string, string>;
      await runAction(action.actionType, config, contactId);
    }
    await prisma.automationRun.create({
      data: { automationId: automation.id, contactId, status: "success" },
    });
  } catch (err) {
    await prisma.automationRun.create({
      data: {
        automationId: automation.id,
        contactId,
        status: "error",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
    });
  }
}

async function runAction(actionType: string, config: Record<string, string>, contactId: string): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");

  switch (actionType) {
    case "send_email": {
      if (!contact.email) throw new Error("Contact has no email address");
      await sendEmail({ to: contact.email, subject: config.subject, body: config.body });
      break;
    }
    case "add_tag": {
      const tags = JSON.parse(contact.tags) as string[];
      if (!tags.includes(config.tag)) {
        tags.push(config.tag);
        await prisma.contact.update({ where: { id: contactId }, data: { tags: JSON.stringify(tags) } });
      }
      break;
    }
    case "move_pipeline_stage": {
      const opportunity = await prisma.opportunity.findFirst({
        where: { contactId, status: "open" },
        orderBy: { createdAt: "desc" },
      });
      if (!opportunity) throw new Error("No open opportunity for this contact");
      await prisma.opportunity.update({ where: { id: opportunity.id }, data: { stageId: config.stageId } });
      break;
    }
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}
