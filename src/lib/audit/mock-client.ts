import { generateMockAudit } from "./mock-data";
import type { AuditResult, PageSpeedClient } from "./types";

const MOCK_LATENCY_MS = 500;
const MOCK_FAILURE_RATE = 0.05;

export function createMockPageSpeedClient(): PageSpeedClient {
  return {
    async audit(url: string): Promise<AuditResult> {
      await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

      if (Math.random() < MOCK_FAILURE_RATE) {
        throw new Error("Simulated PageSpeed Insights API failure (mock mode)");
      }

      return generateMockAudit(url);
    },
  };
}
