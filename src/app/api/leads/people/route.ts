import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { listPeople, type PeopleSortColumn } from "@/services/people";

function parseBool(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

/** Paginated/filterable list of LeadPerson rows (joined to their parent Lead) for the People tab. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "leads.view"));
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = req.nextUrl.searchParams;
  const sortByParam = params.get("sortBy");
  const sortBy: PeopleSortColumn = sortByParam === "name" ? "name" : "createdAt";

  const result = await listPeople({
    search: params.get("search") ?? undefined,
    matchesIcpTitle: parseBool(params.get("matchesIcpTitle")),
    hasEmail: parseBool(params.get("hasEmail")),
    confidence: params.get("confidence") ?? undefined,
    source: params.get("source") ?? undefined,
    sortBy,
    sortDirection: params.get("sortDirection") === "asc" ? "asc" : "desc",
    page: Number(params.get("page") ?? 1),
    pageSize: Number(params.get("pageSize") ?? 25),
  });

  return NextResponse.json(result);
}
