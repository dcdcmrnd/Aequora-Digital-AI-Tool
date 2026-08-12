import { withRetry } from "@/lib/utils/retry";

import type { RegistryPerson, RegistryProvider } from "./types";

const BASE_URL = "https://api.company-information.service.gov.uk";
const FETCH_TIMEOUT_MS = 8000;

// Active company officers only -- Companies House keeps resigned officers in
// the same list with a `resigned_on` date, which would otherwise surface
// people who no longer have any connection to the business.
function isActiveDirectorLike(officer: { officer_role?: string; resigned_on?: string }): boolean {
  if (officer.resigned_on) return false;
  const role = (officer.officer_role ?? "").toLowerCase();
  return role.includes("director") || role.includes("secretary") || role.includes("member") || role.includes("llp-member");
}

// Companies House returns "Surname, Forename Middlename" -- flipped here so
// it matches how the rest of the app displays a person's name.
function toDisplayName(officerName: string): string {
  const [surname, rest] = officerName.split(",").map((s) => s.trim());
  if (!rest) return officerName.trim();
  return `${rest} ${surname}`;
}

function titleCaseRole(role: string): string {
  return role
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

async function fetchJson(path: string, apiKey: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` },
    });
    if (!res.ok) throw new Error(`Companies House responded with ${res.status}.`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export const companiesHouseGB: RegistryProvider = {
  country: "GB",
  costPerLookupCents: 0, // Official free public API -- requires a free API key, not a subscription.

  isConfigured(): boolean {
    return Boolean(process.env.COMPANIES_HOUSE_API_KEY);
  },

  async lookupCompany(companyName: string): Promise<RegistryPerson[]> {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!apiKey) throw new Error("Companies House isn't configured (missing COMPANIES_HOUSE_API_KEY).");

    const search = await withRetry(() =>
      fetchJson(`/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=1`, apiKey),
    );
    const companyNumber = search?.items?.[0]?.company_number;
    if (!companyNumber) return [];

    const officers = await withRetry(() => fetchJson(`/company/${companyNumber}/officers`, apiKey));
    const items: { name?: string; officer_role?: string; resigned_on?: string }[] = officers?.items ?? [];

    return items
      .filter(isActiveDirectorLike)
      .filter((o): o is { name: string; officer_role?: string } => Boolean(o.name))
      .map((o) => ({
        name: toDisplayName(o.name),
        title: o.officer_role ? titleCaseRole(o.officer_role) : null,
        source: "registry_gb" as const,
      }));
  },
};
