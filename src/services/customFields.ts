import type { CustomFieldDefinition } from "@prisma/client";

import { slugifyKey } from "@/lib/customFieldKey";
import { prisma } from "@/lib/prisma";

export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "dropdown", "checkbox", "textarea"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export async function listCustomFieldDefinitions(): Promise<CustomFieldDefinition[]> {
  return prisma.customFieldDefinition.findMany({ orderBy: { order: "asc" } });
}

async function uniqueKey(base: string, excludeId?: string): Promise<string> {
  let key = base || "field";
  let suffix = 2;
  while (await prisma.customFieldDefinition.findFirst({ where: { key, id: excludeId ? { not: excludeId } : undefined } })) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }
  return key;
}

export interface CustomFieldInput {
  name: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export async function createCustomFieldDefinition(input: CustomFieldInput): Promise<CustomFieldDefinition> {
  const key = await uniqueKey(slugifyKey(input.name));
  const maxOrder = await prisma.customFieldDefinition.aggregate({ _max: { order: true } });
  return prisma.customFieldDefinition.create({
    data: {
      name: input.name,
      key,
      type: input.type,
      options: JSON.stringify(input.type === "dropdown" ? (input.options ?? []) : []),
      required: input.required ?? false,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
}

export async function updateCustomFieldDefinition(
  id: string,
  input: Partial<CustomFieldInput>,
): Promise<CustomFieldDefinition> {
  return prisma.customFieldDefinition.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.options !== undefined ? { options: JSON.stringify(input.options) } : {}),
      ...(input.required !== undefined ? { required: input.required } : {}),
    },
  });
}

export async function deleteCustomFieldDefinition(id: string): Promise<void> {
  await prisma.customFieldDefinition.delete({ where: { id } });
}

/**
 * Upserts a contact's custom field values, keyed by field `key` (not id --
 * the form works in terms of keys since that's what's user-visible). Keys
 * that don't match any known definition are silently ignored rather than
 * erroring, so a stale field reference on the client never blocks saving the
 * rest of the contact.
 */
export async function upsertContactCustomFieldValues(
  contactId: string,
  values: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(values);
  if (entries.length === 0) return;

  const definitions = await prisma.customFieldDefinition.findMany({
    where: { key: { in: entries.map(([key]) => key) } },
  });
  const idByKey = new Map(definitions.map((d) => [d.key, d.id]));

  await prisma.$transaction(
    entries
      .filter(([key]) => idByKey.has(key))
      .map(([key, value]) => {
        const fieldId = idByKey.get(key)!;
        return prisma.contactCustomFieldValue.upsert({
          where: { contactId_fieldId: { contactId, fieldId } },
          create: { contactId, fieldId, value },
          update: { value },
        });
      }),
  );
}

/** Flattens a contact's ContactCustomFieldValue rows into {key: value} for the frontend, same shape it submits values in. */
export function flattenContactCustomFields(
  values: { value: string; field: { key: string } }[],
): Record<string, string> {
  return Object.fromEntries(values.map((v) => [v.field.key, v.value]));
}
