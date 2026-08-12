import type { RegistryPerson, RegistryProvider } from "./types";

// Unlike GB (Companies House) and US (OpenCorporates), Australia has no free
// official API returning company director names -- ABN Lookup is free but
// only covers sole traders (where the "owner" already is the registered
// entity), not directors of registered companies. Full director data
// requires an ASIC Connect account, which charges a small per-search fee.
// This provider stays unconfigured until the user sets one up themselves;
// the API route calling it requires an explicit cost acknowledgment either
// way, so a lookup can never run -- or get charged -- silently.
const ASIC_APPROX_COST_PER_LOOKUP_CENTS = 900; // Approximate current-organisation-extract fee; confirm against ASIC Connect's own pricing before enabling.

export const asicAU: RegistryProvider = {
  country: "AU",
  costPerLookupCents: ASIC_APPROX_COST_PER_LOOKUP_CENTS,

  isConfigured(): boolean {
    return process.env.ASIC_CONNECT_ENABLED === "true" && Boolean(process.env.ASIC_CONNECT_ACCOUNT_ID);
  },

  async lookupCompany(_companyName: string): Promise<RegistryPerson[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "ASIC Connect isn't configured. Australian director lookups require your own paid ASIC Connect account " +
          "(set ASIC_CONNECT_ENABLED=true and ASIC_CONNECT_ACCOUNT_ID once you have one) -- there's no free official " +
          "source for this data.",
      );
    }
    // Left unimplemented until an ASIC Connect account is actually available
    // to integrate against -- the account itself has to exist first.
    throw new Error("ASIC Connect integration isn't implemented yet.");
  },
};
