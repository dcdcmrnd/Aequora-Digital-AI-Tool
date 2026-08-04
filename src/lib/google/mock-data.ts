import { faker } from "@faker-js/faker";

import {
  createSeededRandom,
  randomBool,
  randomFloat,
  randomInt,
  type SeededRandom,
} from "@/lib/utils/seeded-random";
import type { MappedBusiness, PlaceSearchParams } from "./types";

const BUSINESS_STATUSES = [
  { value: "OPERATING", weight: 0.92 },
  { value: "CLOSED_TEMPORARILY", weight: 0.05 },
  { value: "CLOSED_PERMANENTLY", weight: 0.03 },
] as const;

const METERS_PER_DEGREE_LAT = 111_320;

function pickBusinessStatus(rng: SeededRandom): string {
  const roll = rng();
  let cumulative = 0;
  for (const { value, weight } of BUSINESS_STATUSES) {
    cumulative += weight;
    if (roll < cumulative) return value;
  }
  return "OPERATING";
}

function parseLocation(location: string) {
  const [city, state, country] = location.split(",").map((part) => part.trim());
  return {
    city: city || location,
    state: state || null,
    country: country || "USA",
  };
}

function randomReviewCount(rng: SeededRandom): number {
  const tier = rng();
  if (tier < 0.6) return randomInt(rng, 0, 50);
  if (tier < 0.9) return randomInt(rng, 51, 200);
  return randomInt(rng, 201, 500);
}

/** Scatters a point around a center within radiusMeters (flat-earth approximation — fine for mock data). */
function offsetLatLng(
  rng: SeededRandom,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
) {
  const distance = rng() * radiusMeters;
  const bearing = rng() * 2 * Math.PI;
  const deltaLat = (distance * Math.cos(bearing)) / METERS_PER_DEGREE_LAT;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180);
  const deltaLng = (distance * Math.sin(bearing)) / metersPerDegreeLng;

  return { lat: centerLat + deltaLat, lng: centerLng + deltaLng };
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/**
 * Deterministic per (keyword, location) so re-running the same search
 * yields the same businesses — this is what both the mock Google Places
 * client and the seed script call, so live mock-mode results and seeded
 * demo data look identical.
 */
export function generateMockBusinesses(params: PlaceSearchParams): MappedBusiness[] {
  const seed = `${params.keyword}::${params.location}::${params.radiusMeters}`;
  const rng = createSeededRandom(seed);
  faker.seed(Math.floor(rng() * 2 ** 31));

  const { city, state, country } = parseLocation(params.location);
  const category = toTitleCase(params.keyword);

  // Arbitrary but stable "center" for the searched location, since we
  // don't have a geocoding API in the stack — good enough to scatter
  // plausible-looking coordinates for map links and mock distance sorting.
  const centerLat = randomFloat(rng, 25, 49, 4);
  const centerLng = randomFloat(rng, -124, -68, 4);

  const target = Math.max(params.targetResults, params.maxResults);
  const count = randomInt(rng, Math.min(8, target), target);

  return Array.from({ length: count }, (): MappedBusiness => {
    const { lat, lng } = offsetLatLng(rng, centerLat, centerLng, params.radiusMeters);
    const hasWebsite = !randomBool(rng, 0.3);
    const name = `${faker.company.name()} ${category}`;

    return {
      googlePlaceId: `mock-${faker.string.alphanumeric(20)}`,
      name,
      category,
      businessStatus: pickBusinessStatus(rng),
      phone: faker.phone.number({ style: "national" }),
      website: hasWebsite ? `https://${faker.internet.domainName()}` : null,
      rating: randomFloat(rng, 2.8, 5.0, 1),
      reviewCount: randomReviewCount(rng),
      address: `${faker.location.streetAddress()}, ${city}${state ? `, ${state}` : ""}`,
      city,
      state,
      country,
      lat,
      lng,
    };
  });
}

/**
 * Used by the mock client to occasionally simulate a transient API failure.
 * Deliberately uses Math.random() rather than the seeded RNG — a retry
 * needs a fresh chance to succeed, not the same deterministic outcome.
 */
export function shouldSimulateFailure(failureRate: number): boolean {
  return Math.random() < failureRate;
}
