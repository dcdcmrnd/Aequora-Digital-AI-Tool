import { createMockGooglePlacesClient } from "./mock-client";
import { createRealGooglePlacesClient } from "./real-client";
import type { GooglePlacesClient } from "./types";

export type { GooglePlacesClient, MappedBusiness, PlaceSearchParams } from "./types";
export { placeSearchParamsSchema } from "./types";

/**
 * Single switch point between mock and real Google Places clients.
 * MOCK_MODE=true (or an empty GOOGLE_PLACES_API_KEY) forces mock —
 * nothing outside this file branches on that.
 */
export function createGooglePlacesClient(): GooglePlacesClient {
  const mockMode = process.env.MOCK_MODE === "true" || !process.env.GOOGLE_PLACES_API_KEY;
  return mockMode ? createMockGooglePlacesClient() : createRealGooglePlacesClient();
}
