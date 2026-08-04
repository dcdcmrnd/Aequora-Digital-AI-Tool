/** Shared between the client search view and the server-rendered lead detail page (for Previous/Next page math). */
export const LEADS_PAGE_SIZE = 10;

/** Matches Google's own title-cased category display (e.g. "plumbers" -> "Plumbers"). */
export function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
