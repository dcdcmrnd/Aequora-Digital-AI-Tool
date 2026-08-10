import type { Lead } from "@prisma/client";

import { enrichFromWebsite } from "@/lib/leadEnrichment";
import { prisma } from "@/lib/prisma";

const ENRICHMENT_CACHE_HOURS = 24;

/**
 * Scans a lead's website for a contact email and social links (Google Places
 * exposes neither) and persists whatever it finds. Best-effort: a lead with
 * no website, an unreachable site, or a site with nothing found is returned
 * unchanged rather than throwing, so one lead's enrichment failing never
 * breaks the batch a search is running it in.
 */
export async function enrichLead(lead: Lead): Promise<Lead> {
  if (!lead.website) return lead;

  const cacheWindowMs = ENRICHMENT_CACHE_HOURS * 60 * 60 * 1000;
  if (lead.enrichedAt && Date.now() - lead.enrichedAt.getTime() < cacheWindowMs) {
    return lead;
  }

  try {
    const result = await enrichFromWebsite(lead.website);
    return await prisma.lead.update({
      where: { id: lead.id },
      data: {
        enrichedEmail: result.email,
        enrichedEmailValid: result.emailValid,
        enrichedOwnerName: result.ownerName,
        enrichedFacebookUrl: result.facebookUrl,
        enrichedInstagramUrl: result.instagramUrl,
        enrichedLinkedinUrl: result.linkedinUrl,
        enrichedTwitterUrl: result.twitterUrl,
        enrichedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`Enrichment failed for lead ${lead.id}:`, error);
    return lead;
  }
}
