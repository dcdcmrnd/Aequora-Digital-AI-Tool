export type RegistryCountry = "GB" | "US" | "AU";

export interface RegistryPerson {
  name: string;
  title: string | null;
  source: "registry_gb" | "registry_us" | "registry_au";
}

export interface RegistryProvider {
  country: RegistryCountry;
  /** 0 = genuinely free (official/public API). Non-zero must be surfaced to the user and explicitly acknowledged before a lookup runs. */
  costPerLookupCents: number;
  /** Whether the credentials/account this provider needs are present — false means "not set up yet", not "temporarily down". */
  isConfigured(): boolean;
  lookupCompany(companyName: string, opts?: { jurisdiction?: string }): Promise<RegistryPerson[]>;
}
