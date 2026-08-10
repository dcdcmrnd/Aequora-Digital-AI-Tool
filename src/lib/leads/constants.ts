/** Shared between the client search view and the server-rendered lead detail page (for Previous/Next page math). */
export const LEADS_PAGE_SIZE = 10;

/** Matches Google's own title-cased category display (e.g. "plumbers" -> "Plumbers"). */
export function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/**
 * "Save as Contact" name prefill for a lead: the business name always goes
 * in the Company field. When an owner name was found, it's split into
 * First/Last so the contact record is about the actual person; otherwise
 * the business name itself fills First Name (rather than being split
 * word-by-word, which mangles multi-word business names) so the contact
 * isn't left with a blank name.
 */
export function leadContactNamePrefill(
  businessName: string,
  ownerName: string | null | undefined,
): { firstName: string; lastName?: string } {
  if (!ownerName?.trim()) return { firstName: businessName };
  const parts = ownerName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || undefined };
}
