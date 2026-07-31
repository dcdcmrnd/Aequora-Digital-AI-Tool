export interface OpportunityInput {
  hasWebsite: boolean;
  /** website_audits.overall_score, 0-100 */
  websiteScore: number | null;
  performanceScore: number | null;
  seoScore: number | null;
  httpsEnabled: boolean | null;
  rating: number | null;
  reviewCount: number | null;
}

/**
 * Additive, capped-at-100 scoring. Each check is independent and
 * null-safe — when hasWebsite is false the audit fields are null, so
 * rules 2-4 simply don't fire rather than needing explicit branching.
 */
export function calculateOpportunityScore(input: OpportunityInput): number {
  let score = 0;

  if (!input.hasWebsite) score += 40;
  if (input.websiteScore !== null && input.websiteScore < 50) score += 30;
  if (input.performanceScore !== null && input.performanceScore < 50) score += 10;
  if (input.seoScore !== null && input.seoScore < 50) score += 10;
  if (input.httpsEnabled === false) score += 10;
  if (input.rating !== null && input.rating > 4.5) score += 15;
  if (input.reviewCount !== null && input.reviewCount > 100) score += 10;
  if (!input.hasWebsite && input.rating !== null && input.rating > 4.7) score += 20;

  return Math.min(score, 100);
}
