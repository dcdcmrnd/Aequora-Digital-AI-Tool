import { prisma } from "@/lib/prisma";

export interface TagWithCount {
  name: string;
  count: number;
}

/** Every tag currently in use across all contacts, with how many contacts carry it -- tags have no table of their own, so this scans Contact.tags (JSON array) same as GET /api/contacts/tags. */
export async function listTagsWithCounts(): Promise<TagWithCount[]> {
  const contacts = await prisma.contact.findMany({ select: { tags: true } });
  const counts = new Map<string, number>();

  for (const contact of contacts) {
    let tags: string[];
    try {
      tags = JSON.parse(contact.tags);
    } catch {
      continue;
    }
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Loads every contact carrying at least one of `names`, for rename/merge/delete to rewrite. */
async function contactsWithAnyTag(names: string[]) {
  const escaped = names.map((n) => n.replace(/"/g, '\\"'));
  return prisma.contact.findMany({
    where: { OR: escaped.map((n) => ({ tags: { contains: `"${n}"` } })) },
    select: { id: true, tags: true },
  });
}

/** Renames a tag across every contact that has it. No-op (not an error) if `to` already exists on a contact that also had `from` -- the duplicate just collapses. */
export async function renameTag(from: string, to: string): Promise<number> {
  const contacts = await contactsWithAnyTag([from]);
  await prisma.$transaction(
    contacts.map((c) => {
      const tags: string[] = JSON.parse(c.tags);
      const next = Array.from(new Set(tags.map((t) => (t === from ? to : t))));
      return prisma.contact.update({ where: { id: c.id }, data: { tags: JSON.stringify(next) } });
    }),
  );
  return contacts.length;
}

/** Collapses several tags into one target tag across every contact carrying any of them. */
export async function mergeTags(sources: string[], target: string): Promise<number> {
  const sourceSet = new Set(sources);
  const contacts = await contactsWithAnyTag([...sources, target]);
  await prisma.$transaction(
    contacts.map((c) => {
      const tags: string[] = JSON.parse(c.tags);
      const hasAnySource = tags.some((t) => sourceSet.has(t));
      const next = hasAnySource
        ? Array.from(new Set(tags.filter((t) => !sourceSet.has(t)).concat(target)))
        : tags;
      return prisma.contact.update({ where: { id: c.id }, data: { tags: JSON.stringify(next) } });
    }),
  );
  return contacts.length;
}

/** Removes a tag from every contact that has it -- doesn't touch the contacts themselves otherwise. */
export async function deleteTag(name: string): Promise<number> {
  const contacts = await contactsWithAnyTag([name]);
  await prisma.$transaction(
    contacts.map((c) => {
      const tags: string[] = JSON.parse(c.tags);
      const next = tags.filter((t) => t !== name);
      return prisma.contact.update({ where: { id: c.id }, data: { tags: JSON.stringify(next) } });
    }),
  );
  return contacts.length;
}
