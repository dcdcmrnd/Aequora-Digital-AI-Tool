import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });
  }
  return client;
}

export const AEQUORA_BUSINESS_CONTEXT = `You are the AI business consultant for Aequora Digital, a remote-first web design and digital services agency based in the Philippines serving U.S. small businesses ($300K–$1M revenue).

SERVICES & PRICING:
- Website Build — Starter: $1,999 (single-page, 5–7 days)
- Website Build — Growth: $4,999 (up to 10 pages, full SEO, 7–10 days, includes 1 month free management)
- Website Management — Managed: $999/month (hosting, SEO, content updates up to 4/mo, security, backups)
- Google Ads — Starter: $300/month + ad spend
- Google Ads — Growth: $600/month + ad spend
- VA Placement: Free to client (referral fee model)
- Project Outsourcing: Custom quote

TEAM: DC Miranda (Dev & Lead), Keyssa Luna (Sales), Misa Abad (Sales & CS), Aren Ramas (Data Research)

POSITIONING: One team, end-to-end delivery, AI-powered workflows. Not an agency — a partner. Premium but fair pricing for the segment.

TARGET CLIENT: U.S. small business owner, $300K–$1M/year, local service businesses, weak online presence, no existing ads, outdated or no website.

CORE PAIN POINT: They waste time hiring, onboarding, and managing VAs and freelancers.

BRAND VOICE: Direct, warm, professional. No buzzwords. No hype. Plain language.

You help the team with:
- Sales strategy and objection handling
- Service positioning and pricing questions
- Client communication drafts
- Process and workflow recommendations
- Growth strategy and next steps for the business
- Competitive positioning
- Marketing and outreach ideas

Be specific to Aequora's actual services, pricing, and market position. Don't give generic business advice — ground everything in what the team actually offers and who they actually serve.`;

export interface AuditRecommendationsInput {
  businessName: string;
  category: string | null;
  website: string | null;
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  mobileFriendly: boolean | null;
  httpsEnabled: boolean | null;
  hasMetaDescription: boolean | null;
  hasTitle: boolean | null;
  sslValid: boolean | null;
}

function scoreLine(label: string, value: number | null): string {
  return `- ${label}: ${value === null ? "not measured" : `${value}/100`}`;
}

function checkLine(label: string, value: boolean | null): string {
  return `- ${label}: ${value === null ? "not checked" : value ? "yes" : "no"}`;
}

/**
 * Turns raw PageSpeed-style audit numbers into a prompt asking for advice
 * framed around Aequora's own services — this is meant to help the team
 * pitch the lead, not just hand back generic SEO tips.
 */
export function buildAuditRecommendationsPrompt(input: AuditRecommendationsInput): string {
  return `Here is a website audit for a prospective client. Give the Aequora team specific, actionable recommendations for this business — grounded only in the data below, and tied to which of Aequora's actual services (see your instructions) would address each issue.

BUSINESS: ${input.businessName}${input.category ? ` (${input.category})` : ""}
WEBSITE: ${input.website ?? "No website on file"}

SCORES:
${scoreLine("Performance", input.performanceScore)}
${scoreLine("SEO", input.seoScore)}
${scoreLine("Accessibility", input.accessibilityScore)}
${scoreLine("Best Practices", input.bestPracticesScore)}

TECHNICAL CHECKS:
${checkLine("Mobile friendly", input.mobileFriendly)}
${checkLine("HTTPS enabled", input.httpsEnabled)}
${checkLine("Valid SSL", input.sslValid)}
${checkLine("Has page title", input.hasTitle)}
${checkLine("Has meta description", input.hasMetaDescription)}

Write plain text (no markdown symbols like # or **). Structure it as:
1. A short "Where they stand" summary (2-3 sentences, plain language, no jargon).
2. "Key issues" — a short list of the specific problems this data actually shows (don't invent findings beyond what's given; if something wasn't measured, don't claim it's bad).
3. "How Aequora can help" — for each real issue, name the specific Aequora service that addresses it and why, in one line each.
Keep the whole thing under 250 words. Be direct and specific to this business, not generic advice.`;
}

/** Calls Claude with the Aequora business-consultant persona to generate audit-based recommendations. Throws if ANTHROPIC_API_KEY isn't configured or the call fails. */
export async function generateAuditRecommendations(input: AuditRecommendationsInput): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI recommendations aren't configured — ANTHROPIC_API_KEY is missing.");
  }

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 600,
    system: AEQUORA_BUSINESS_CONTEXT,
    messages: [{ role: "user", content: buildAuditRecommendationsPrompt(input) }],
  });

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("The AI didn't return a usable response.");
  return text.text.trim();
}

/**
 * Runs an arbitrary, team-authored prompt (from the "AI Prompt" automation
 * action) through Claude with the same Aequora business-consultant framing
 * as the rest of this file. Merge tags in the prompt are already resolved
 * by the caller before this runs — this function only talks to the model.
 */
export async function runAiPrompt(prompt: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI Prompt step isn't configured — ANTHROPIC_API_KEY is missing.");
  }

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    system: AEQUORA_BUSINESS_CONTEXT,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("The AI didn't return a usable response.");
  return text.text.trim();
}

export function buildTaskAssistantSystemPrompt(context: {
  userName: string;
  userRole: string;
  today: string;
  tasks: {
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    projectName: string;
  }[];
  recentActivity: {
    action: string;
    entityType: string;
    entityName: string;
    userName: string;
    createdAt: string;
  }[];
}): string {
  const taskList = context.tasks
    .slice(0, 30)
    .map(
      (t) =>
        `- [${t.priority.toUpperCase()}] "${t.title}" (${t.status}) in ${t.projectName}${t.dueDate ? ` — due ${t.dueDate}` : ""}`
    )
    .join("\n");

  const activityList = context.recentActivity
    .slice(0, 20)
    .map(
      (a) =>
        `- ${a.userName} ${a.action} ${a.entityType} "${a.entityName}" at ${a.createdAt}`
    )
    .join("\n");

  return `You are a task assistant for ${context.userName} (${context.userRole}) at Aequora Digital.

TODAY: ${context.today}

CURRENT USER'S TASKS:
${taskList || "No active tasks."}

RECENT TEAM ACTIVITY:
${activityList || "No recent activity."}

Help ${context.userName} prioritize their work, answer questions about tasks and deadlines, and provide actionable guidance. Be concise and direct. When asked what to work on, lead with overdue items, then today's due items, then high-priority items without dates.`;
}
