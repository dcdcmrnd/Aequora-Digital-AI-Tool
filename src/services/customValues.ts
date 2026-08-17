import type { CustomValue } from "@prisma/client";

import { slugifyKey } from "@/lib/customFieldKey";
import { prisma } from "@/lib/prisma";

export async function listCustomValues(): Promise<CustomValue[]> {
  return prisma.customValue.findMany({ orderBy: { name: "asc" } });
}

/** Appends -2, -3, ... on a slug collision rather than failing the request -- same "just make it work" spirit as most name-based creates in this app. */
async function uniqueKey(base: string, excludeId?: string): Promise<string> {
  let key = base || "value";
  let suffix = 2;
  while (await prisma.customValue.findFirst({ where: { key, id: excludeId ? { not: excludeId } : undefined } })) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }
  return key;
}

export async function createCustomValue(name: string, value: string): Promise<CustomValue> {
  const key = await uniqueKey(slugifyKey(name));
  return prisma.customValue.create({ data: { name, key, value } });
}

export async function updateCustomValue(
  id: string,
  data: { name?: string; value?: string },
): Promise<CustomValue> {
  return prisma.customValue.update({ where: { id }, data });
}

export async function deleteCustomValue(id: string): Promise<void> {
  await prisma.customValue.delete({ where: { id } });
}
