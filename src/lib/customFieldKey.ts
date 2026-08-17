/**
 * Slugifies a display name into the "Unique Key" used in merge tokens --
 * shared by Custom Values ({{custom_values.<key>}}) and Custom Field
 * definitions, mirroring how GHL derives a field's key from its name.
 */
export function slugifyKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
