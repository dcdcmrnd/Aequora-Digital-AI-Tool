import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { CUSTOM_FIELD_TYPES, createCustomFieldDefinition, listCustomFieldDefinitions } from "@/services/customFields";

/** Custom Field definitions (GHL-style) -- user-defined fields on Contact records. Readable by anyone signed in (the Contact form needs them); only admins can manage the definitions. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fields = await listCustomFieldDefinitions();
  return NextResponse.json({
    fields: fields.map((f) => ({ ...f, options: JSON.parse(f.options) })),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Name and type are required." }, { status: 400 });

  const field = await createCustomFieldDefinition(parsed.data);
  return NextResponse.json({ field: { ...field, options: JSON.parse(field.options) } }, { status: 201 });
}
