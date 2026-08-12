import { withRetry } from "@/lib/utils/retry";

import type { RegistryPerson, RegistryProvider } from "./types";

const BASE_URL = "https://api.opencorporates.com/v0.4";
const FETCH_TIMEOUT_MS = 8000;

async function fetchJson(path: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const token = process.env.OPENCORPORATES_API_KEY;
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${token ? `${sep}api_token=${token}` : ""}`;
  try {
    const res = await fetch(url, { signal: controller.signal });
    // OpenCorporates' free tier returns 403 once its (low) monthly quota is
    // used up -- surfaced as a distinct message so it doesn't read like a
    // broken integration.
    if (res.status === 403) throw new Error("OpenCorporates free-tier request limit reached for this month.");
    if (!res.ok) throw new Error(`OpenCorporates responded with ${res.status}.`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export const openCorporatesUS: RegistryProvider = {
  country: "US",
  costPerLookupCents: 0, // Free tier (low monthly quota) -- no subscription; an optional free API key raises the limit.

  isConfigured(): boolean {
    return true; // Free tier works without a key, just at a lower rate limit.
  },

  async lookupCompany(companyName: string, opts?: { jurisdiction?: string }): Promise<RegistryPerson[]> {
    const jurisdictionQuery = opts?.jurisdiction ? `&jurisdiction_code=us_${opts.jurisdiction.toLowerCase()}` : "&jurisdiction_code=us";
    const search = await withRetry(() =>
      fetchJson(`/companies/search?q=${encodeURIComponent(companyName)}${jurisdictionQuery}&per_page=1`),
    );
    const company = search?.results?.companies?.[0]?.company;
    if (!company?.company_number || !company?.jurisdiction_code) return [];

    // Officer data on US filings is sparse compared to GB/AU registries (most
    // states don't require it) -- this often returns nothing, which is
    // expected, not a bug.
    const officers = await withRetry(() =>
      fetchJson(`/companies/${company.jurisdiction_code}/${company.company_number}/officers`),
    );
    const items: { officer?: { name?: string; position?: string } }[] = officers?.results?.officers ?? [];

    return items
      .map((o) => o.officer)
      .filter((o): o is { name: string; position?: string } => Boolean(o?.name))
      .map((o) => ({
        name: o.name,
        title: o.position ?? null,
        source: "registry_us" as const,
      }));
  },
};
