import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { auditLead } from "@/services/audit";
import { getLeadById } from "@/services/business";

/** Re-runs (or reuses a cached) website audit for a single lead. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "admin";
  const canManage = isAdmin || (await checkPermission(session.user.id, "leads.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lead = await getLeadById(params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { lead: updated, audit } = await auditLead(lead);

  await logActivity({
    userId: session.user.id,
    action: "updated",
    entityType: "lead",
    entityId: updated.id,
    entityName: updated.name,
    metadata: { action: "audit" },
  });

  return NextResponse.json({ lead: { ...updated, audit } });
}
