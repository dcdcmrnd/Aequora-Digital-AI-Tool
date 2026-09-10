import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { identifyEmail } from "@/lib/leads/emailIdentity";
import { checkPermission } from "@/lib/permissions";

export const maxDuration = 60;

const schema = z.object({ email: z.string().trim().min(3) });

/**
 * Given a bare email address: verifies domain-level deliverability, and
 * best-effort identifies the company behind the domain plus (if a match is
 * found on that company's own site) the person's name and title. See
 * emailIdentity.ts for what "verification" does and doesn't mean here.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "An email address is required." }, { status: 400 });

  const result = await identifyEmail(parsed.data.email);

  await logActivity({
    userId: session.user.id,
    action: "created",
    entityType: "email_identity_lookup",
    entityId: result.email,
    entityName: result.email,
    metadata: { verification: result.verification, companyFound: !!result.company, personFound: !!result.person },
  });

  return NextResponse.json(result);
}
