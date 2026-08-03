import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { listLeads, type LeadSortColumn } from "@/services/business";

const SORTABLE_COLUMNS: LeadSortColumn[] = ["opportunityScore", "reviewCount", "rating", "createdAt"];

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
  const sortByParam = searchParams.get("sortBy") as LeadSortColumn | null;
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");

  const result = await listLeads({
    category: searchParams.get("category") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    minRating: minRating ? Number(minRating) : undefined,
    minReviews: minReviews ? Number(minReviews) : undefined,
    hasWebsite: hasWebsiteParam === "true" ? true : hasWebsiteParam === "false" ? false : undefined,
    sortBy: sortByParam && SORTABLE_COLUMNS.includes(sortByParam) ? sortByParam : undefined,
    sortDirection: searchParams.get("sortDirection") === "asc" ? "asc" : "desc",
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });

  return NextResponse.json(result);
}
