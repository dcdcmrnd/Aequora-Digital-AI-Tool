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
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
  notes: string | null;
}

export function contactMergeValues(contact: MergeContact): Record<string, string> {
  const parts = contact.name.trim().split(/\s+/).filter(Boolean);
  return {
    "{{contact.first_name}}": parts[0] ?? "",
    "{{contact.last_name}}": parts.slice(1).join(" "),
    "{{contact.email}}": contact.email ?? "",
    "{{contact.phone}}": contact.phone ?? "",
    "{{contact.company}}": contact.company ?? "",
    "{{contact.website}}": contact.website ?? "",
    "{{contact.details}}": contact.notes ?? "",
  };
}

export function applyMergeTags(text: string, values: Record<string, string>): string {
  let result = text;
  for (const [token, value] of Object.entries(values)) {
    result = result.split(token).join(value);
  }
  return result;
}
