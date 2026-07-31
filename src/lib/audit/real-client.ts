import { mapPageSpeedResponse } from "./mapper";
import { pageSpeedApiResponseSchema } from "./types";
import type { AuditResult, PageSpeedClient } from "./types";

const PAGESPEED_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CATEGORIES = ["performance", "seo", "accessibility", "best-practices"];

export function createRealPageSpeedClient(): PageSpeedClient {
  return {
    async audit(url: string): Promise<AuditResult> {
      const params = new URLSearchParams({
        url,
        key: process.env.GOOGLE_PAGESPEED_API_KEY ?? "",
        strategy: "mobile",
      });
      for (const category of CATEGORIES) {
        params.append("category", category);
      }

      const response = await fetch(`${PAGESPEED_URL}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`PageSpeed Insights API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      const parsed = pageSpeedApiResponseSchema.parse(json);

      return mapPageSpeedResponse(parsed);
    },
  };
}
