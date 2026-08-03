export interface MergeTag {
  token: string;
  label: string;
}

/** Custom values available when composing a Send Email step. */
export const CONTACT_MERGE_TAGS: MergeTag[] = [
  { token: "{{contact.first_name}}", label: "First Name" },
  { token: "{{contact.last_name}}", label: "Last Name" },
  { token: "{{contact.email}}", label: "Email" },
  { token: "{{contact.phone}}", label: "Contact Number" },
  { token: "{{contact.company}}", label: "Company" },
  { token: "{{contact.website}}", label: "Website" },
  { token: "{{contact.details}}", label: "Details" },
];

interface MergeContact {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
  notes: string | null;
}

export function contactMergeValues(contact: MergeContact): Record<string, string> {
  // Prefer explicit firstName/lastName; fall back to splitting the display
  // name for contacts created before those fields existed (e.g. imported
  // from a lead search, or via the older single-field contact form).
  const parts = contact.name.trim().split(/\s+/).filter(Boolean);
  const firstName = contact.firstName?.trim() || parts[0] || "";
  const lastName = contact.lastName?.trim() || parts.slice(1).join(" ");
  return {
    "{{contact.first_name}}": firstName,
    "{{contact.last_name}}": lastName,
    "{{contact.email}}": contact.email ?? "",
    "{{contact.phone}}": contact.phone ?? "",
    "{{contact.company}}": contact.company ?? "",
    "{{contact.website}}": contact.website ?? "",
    "{{contact.details}}": contact.notes ?? "",
  };
}

/** Placeholder values used when sending a test email from the builder, where there's no real contact yet. */
export const SAMPLE_MERGE_VALUES: Record<string, string> = {
  "{{contact.first_name}}": "John",
  "{{contact.last_name}}": "Doe",
  "{{contact.email}}": "john.doe@example.com",
  "{{contact.phone}}": "(555) 123-4567",
  "{{contact.company}}": "Acme Inc.",
  "{{contact.website}}": "https://acme.com",
  "{{contact.details}}": "Sample details",
};

export function applyMergeTags(text: string, values: Record<string, string>): string {
  let result = text;
  for (const [token, value] of Object.entries(values)) {
    result = result.split(token).join(value);
  }
  return result;
}
