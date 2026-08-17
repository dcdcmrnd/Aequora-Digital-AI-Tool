import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { createCustomValue, listCustomValues } from "@/services/customValues";

/** Account-wide Custom Values (GHL-style) -- reusable snippets referenced as {{custom_values.<key>}} in email/automation bodies. Readable by anyone signed in (the merge-tag picker needs them); only admins can manage them. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const values = await listCustomValues();
  return NextResponse.json({ values });
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  value: z.string().default(""),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const value = await createCustomValue(parsed.data.name, parsed.data.value);
  return NextResponse.json({ value }, { status: 201 });
}
