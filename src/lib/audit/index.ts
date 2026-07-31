import { createMockPageSpeedClient } from "./mock-client";
import { createRealPageSpeedClient } from "./real-client";
import type { PageSpeedClient } from "./types";

export type { AuditResult, PageSpeedClient } from "./types";

/**
 * Single switch point between mock and real PageSpeed clients.
 * MOCK_MODE=true (or an empty GOOGLE_PAGESPEED_API_KEY) forces mock —
 * nothing outside this file branches on that.
 */
export function createPageSpeedClient(): PageSpeedClient {
  const mockMode = process.env.MOCK_MODE === "true" || !process.env.GOOGLE_PAGESPEED_API_KEY;
  return mockMode ? createMockPageSpeedClient() : createRealPageSpeedClient();
}
