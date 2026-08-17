import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { deleteTag, listTagsWithCounts, mergeTags, renameTag } from "@/services/contactTags";

/** Every tag in use across all contacts, with usage counts -- backs the Settings > Tags manager (distinct from GET /api/contacts/tags, which is just names for autocomplete). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tags = await listTagsWithCounts();
  return NextResponse.json({ tags });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), from: z.string().trim().min(1), to: z.string().trim().min(1) }),
  z.object({ action: z.literal("merge"), sources: z.array(z.string().trim().min(1)).min(1), target: z.string().trim().min(1) }),
  z.object({ action: z.literal("delete"), name: z.string().trim().min(1) }),
]);

/** Single endpoint for all three tag-management actions, mirroring how few enough call sites exist to not warrant separate routes per action. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  let affected: number;
  if (parsed.data.action === "rename") {
    affected = await renameTag(parsed.data.from, parsed.data.to);
  } else if (parsed.data.action === "merge") {
    affected = await mergeTags(parsed.data.sources, parsed.data.target);
  } else {
    affected = await deleteTag(parsed.data.name);
  }

  return NextResponse.json({ affected });
}
