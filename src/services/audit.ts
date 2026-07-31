import type { Lead, LeadAudit } from "@prisma/client";

import { calculateOpportunityScore } from "@/lib/scoring/opportunity";
import { prisma } from "@/lib/prisma";
import { auditWebsite } from "@/services/pagespeed";

const AUDIT_CACHE_HOURS = 24;

export interface AuditOutcome {
  lead: Lead;
  audit: LeadAudit | null;
}

async function applyOpportunityScore(lead: Lead, audit: LeadAudit | null): Promise<Lead> {
  const score = calculateOpportunityScore({
    hasWebsite: !!lead.website,
    websiteScore: audit?.overallScore ?? null,
    performanceScore: audit?.performanceScore ?? null,
    seoScore: audit?.seoScore ?? null,
    httpsEnabled: audit?.httpsEnabled ?? null,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
  });

  return prisma.lead.update({
    where: { id: lead.id },
    data: { opportunityScore: score, opportunityScoreUpdatedAt: new Date() },
  });
}

/**
 * Runs (or reuses a cached) PageSpeed audit for a lead, then recomputes
 * its opportunity score. Leads without a website are marked as such —
 * any stale audit row is cleared and the score is recomputed with a null
 * website score, which alone contributes the "no website" scoring rule.
 */
export async function auditLead(lead: Lead): Promise<AuditOutcome> {
  if (!lead.website) {
    await prisma.leadAudit.deleteMany({ where: { leadId: lead.id } });
    const updated = await applyOpportunityScore(lead, null);
    return { lead: updated, audit: null };
  }

  const existing = await prisma.leadAudit.findUnique({ where: { leadId: lead.id } });
  const cacheWindowMs = AUDIT_CACHE_HOURS * 60 * 60 * 1000;

  if (existing && Date.now() - existing.lastScanned.getTime() < cacheWindowMs) {
    return { lead, audit: existing };
  }

  const result = await auditWebsite(lead.website);

  const fields = {
    performanceScore: result.performanceScore,
    seoScore: result.seoScore,
    accessibilityScore: result.accessibilityScore,
    bestPracticesScore: result.bestPracticesScore,
    mobileFriendly: result.mobileFriendly,
    httpsEnabled: result.httpsEnabled,
    hasMetaDescription: result.hasMetaDescription,
    hasTitle: result.hasTitle,
    sslValid: result.sslValid,
    pageSpeed: result.pageSpeed,
    overallScore: result.overallScore,
    lastScanned: new Date(),
  };

  const upserted = await prisma.leadAudit.upsert({
    where: { leadId: lead.id },
    create: { leadId: lead.id, ...fields },
    update: fields,
  });

  const updatedLead = await applyOpportunityScore(lead, upserted);
  return { lead: updatedLead, audit: upserted };
}
