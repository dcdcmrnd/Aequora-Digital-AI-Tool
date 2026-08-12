import { asicAU } from "./asicAU";
import { companiesHouseGB } from "./companiesHouseGB";
import { openCorporatesUS } from "./openCorporatesUS";
import type { RegistryCountry, RegistryProvider } from "./types";

const PROVIDERS: Record<RegistryCountry, RegistryProvider> = {
  GB: companiesHouseGB,
  US: openCorporatesUS,
  AU: asicAU,
};

export function getRegistryProvider(country: RegistryCountry): RegistryProvider {
  return PROVIDERS[country];
}

export type { RegistryCountry, RegistryPerson, RegistryProvider } from "./types";
