import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { DEFAULT_ICP_TITLES } from "@/lib/leads/constants";
import { getRegistryProvider } from "@/lib/leads/registry";
import { normalizeName } from "@/lib/leads/personFinder";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getLeadById } from "@/services/business";

export const maxDuration = 30;

const schema = z.object({
  country: z.enum(["GB", "US", "AU"]),
  // Required (and must be true) for any provider with a non-zero cost --
  // never runs a paid lookup off the back of a plain request.
  acknowledgeCost: z.boolean().optional(),
});

/** Looks up a lead's business in a country's official company registry for director/officer names — a different, often more complete source than website crawling. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const lead = await getLeadById(params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const provider = getRegistryProvider(parsed.data.country);
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: `${parsed.data.country} registry lookups aren't configured yet.`, costPerLookupCents: provider.costPerLookupCents },
      { status: 409 },
    );
  }
  if (provider.costPerLookupCents > 0 && !parsed.data.acknowledgeCost) {
    return NextResponse.json(
      {
        error: `This lookup costs approximately $${(provider.costPerLookupCents / 100).toFixed(2)} — resend with acknowledgeCost: true to proceed.`,
        costPerLookupCents: provider.costPerLookupCents,
      },
      { status: 402 },
    );
  }

  let results;
  try {
    results = await provider.lookupCompany(lead.name, { jurisdiction: lead.state ?? undefined });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Registry lookup failed." }, { status: 502 });
  }

  const existing = await prisma.leadPerson.findMany({ where: { leadId: lead.id } });
  const existingByName = new Map(existing.map((p) => [normalizeName(p.name ?? ""), p]));
  const lowerIcpTitles = DEFAULT_ICP_TITLES.map((t) => t.toLowerCase());

  for (const person of results) {
    const match = existingByName.get(normalizeName(person.name));
    const data = {
      name: person.name,
      title: person.title,
      matchesIcpTitle: person.title ? lowerIcpTitles.some((t) => person.title!.toLowerCase().includes(t)) : false,
      source: person.source,
      confidence: "high" as const, // Registry data is an official record, not a guess.
    };
    if (match) {
      await prisma.leadPerson.update({ where: { id: match.id }, data });
    } else {
      await prisma.leadPerson.create({ data: { leadId: lead.id, ...data } });
    }
  }

  const people = await prisma.leadPerson.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "asc" } });

  await logActivity({
    userId: session.user.id,
    action: "updated",
    entityType: "lead",
    entityId: lead.id,
    entityName: lead.name,
    metadata: { action: "find-people-registry", country: parsed.data.country, found: results.length },
  });

  return NextResponse.json({ people });
}
