export const IMPORT_FIELDS = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "name", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Contact Number" },
  { key: "company", label: "Company" },
  { key: "website", label: "Website" },
  { key: "notes", label: "Details" },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

const FIELD_MATCHERS: Record<ImportFieldKey, RegExp> = {
  firstName: /^(first\s*name|given\s*name)$/i,
  lastName: /^(last\s*name|surname|family\s*name)$/i,
  name: /^(full\s*name|name|contact\s*name)$/i,
  email: /^(e-?mail( address)?)$/i,
  phone: /^(phone( number)?|contact\s*number|mobile|cell)$/i,
  company: /^(company|organization|business( name)?)$/i,
  website: /^(website|site|url)$/i,
  notes: /^(details|notes|description)$/i,
};

export type HeaderMapping = Partial<Record<ImportFieldKey, string>>;

export function autoMapHeaders(headers: string[]): HeaderMapping {
  const mapping: HeaderMapping = {};
  for (const field of IMPORT_FIELDS) {
    const match = headers.find((h) => FIELD_MATCHERS[field.key].test(h.trim()));
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

export interface ImportedContact {
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  notes?: string;
}

export function buildContactsFromMapping(rows: Record<string, string>[], mapping: HeaderMapping): ImportedContact[] {
  return rows
    .map((row) => {
      const get = (key: ImportFieldKey) => (mapping[key] ? (row[mapping[key]!] ?? "").trim() : "");
      const firstName = get("firstName");
      const lastName = get("lastName");
      const fullName = get("name");
      const name = fullName || [firstName, lastName].filter(Boolean).join(" ");

      return {
        name,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: get("email") || undefined,
        phone: get("phone") || undefined,
        company: get("company") || undefined,
        website: get("website") || undefined,
        notes: get("notes") || undefined,
      };
    })
    .filter((c) => c.name);
}
