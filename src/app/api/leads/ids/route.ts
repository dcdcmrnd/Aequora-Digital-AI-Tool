import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { listLeadIds, type LeadSortColumn } from "@/services/business";

const SORTABLE_COLUMNS: LeadSortColumn[] = ["opportunityScore", "reviewCount", "rating", "createdAt", "email"];

/** Ordered lead ids for the current filter/sort context — powers Previous/Next on the lead detail page. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "admin";
  const canView = isAdmin || (await checkPermission(session.user.id, "leads.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const minRating = searchParams.get("minRating");
  const minReviews = searchParams.get("minReviews");
  const hasWebsiteParam = searchParams.get("hasWebsite");
  const hasEmailParam = searchParams.get("hasEmail");
  const sortByParam = searchParams.get("sortBy") as LeadSortColumn | null;

  const ids = await listLeadIds({
    searchId: searchParams.get("searchId") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    minRating: minRating ? Number(minRating) : undefined,
    minReviews: minReviews ? Number(minReviews) : undefined,
    hasWebsite: hasWebsiteParam === "true" ? true : hasWebsiteParam === "false" ? false : undefined,
    hasEmail: hasEmailParam === "true" ? true : hasEmailParam === "false" ? false : undefined,
    sortBy: sortByParam && SORTABLE_COLUMNS.includes(sortByParam) ? sortByParam : undefined,
    sortDirection: searchParams.get("sortDirection") === "asc" ? "asc" : "desc",
  });

  return NextResponse.json({ ids });
}
