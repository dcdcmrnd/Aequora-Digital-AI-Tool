import { z } from "zod";

export interface AuditResult {
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  mobileFriendly: boolean | null;
  httpsEnabled: boolean | null;
  hasMetaDescription: boolean | null;
  hasTitle: boolean | null;
  /** PageSpeed has no real certificate check; approximated from the HTTPS audit. */
  sslValid: boolean | null;
  /** Speed Index, in seconds. */
  pageSpeed: number | null;
  overallScore: number | null;
}

export interface PageSpeedClient {
  audit(url: string): Promise<AuditResult>;
}

/** Subset of the PageSpeed Insights v5 response we consume. */
const categorySchema = z.object({ score: z.number().nullable().optional() });
const auditSchema = z.object({
  score: z.number().nullable().optional(),
  numericValue: z.number().optional(),
});

export const pageSpeedApiResponseSchema = z.object({
  lighthouseResult: z.object({
    categories: z.object({
      performance: categorySchema.optional(),
      seo: categorySchema.optional(),
      accessibility: categorySchema.optional(),
      "best-practices": categorySchema.optional(),
    }),
    audits: z.record(z.string(), auditSchema),
  }),
});
export type PageSpeedApiResponse = z.infer<typeof pageSpeedApiResponseSchema>;
