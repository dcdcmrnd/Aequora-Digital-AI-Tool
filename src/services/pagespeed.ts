import { createPageSpeedClient } from "@/lib/audit";
import type { AuditResult } from "@/lib/audit";
import { withRetry } from "@/lib/utils/retry";

export async function auditWebsite(url: string): Promise<AuditResult> {
  const client = createPageSpeedClient();

  return withRetry(() => client.audit(url));
}
