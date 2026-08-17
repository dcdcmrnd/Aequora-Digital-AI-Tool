import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { CUSTOM_FIELD_TYPES, deleteCustomFieldDefinition, updateCustomFieldDefinition } from "@/services/customFields";

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.enum(CUSTOM_FIELD_TYPES).optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  const field = await updateCustomFieldDefinition(params.id, parsed.data);
  return NextResponse.json({ field: { ...field, options: JSON.parse(field.options) } });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await deleteCustomFieldDefinition(params.id);
  return NextResponse.json({ success: true });
}
