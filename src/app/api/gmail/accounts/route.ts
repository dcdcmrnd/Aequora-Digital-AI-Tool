import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getConnectedEmails } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = req.nextUrl.searchParams.get("scope") === "own" ? "own" : "agency";
  const ownerId = scope === "own" ? session.user.id : null;

  const emails = await getConnectedEmails(ownerId);
  return NextResponse.json({ emails });
}
