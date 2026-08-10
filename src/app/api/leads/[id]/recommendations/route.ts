import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { generateAuditRecommendations } from "@/lib/ai";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getLeadById } from "@/services/business";

/** Generates (or regenerates) AI recommendations for a lead's audit, framed around Aequora's own services. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "admin";
  const canUse = isAdmin || (await checkPermission(session.user.id, "ai.consultant"));
  if (!canUse) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lead = await getLeadById(params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lead.audit) {
    return NextResponse.json({ error: "Run a website audit first." }, { status: 400 });
  }

  let text: string;
  try {
    text = await generateAuditRecommendations({
      businessName: lead.name,
      category: lead.category,
      website: lead.website,
      performanceScore: lead.audit.performanceScore,
      seoScore: lead.audit.seoScore,
      accessibilityScore: lead.audit.accessibilityScore,
      bestPracticesScore: lead.audit.bestPracticesScore,
      mobileFriendly: lead.audit.mobileFriendly,
      httpsEnabled: lead.audit.httpsEnabled,
      hasMetaDescription: lead.audit.hasMetaDescription,
      hasTitle: lead.audit.hasTitle,
      sslValid: lead.audit.sslValid,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't generate recommendations." },
      { status: 502 },
    );
  }

  const audit = await prisma.leadAudit.update({
    where: { leadId: lead.id },
    data: { aiRecommendations: text, aiRecommendationsAt: new Date() },
  });

  return NextResponse.json({ audit });
}
