import { generateMockBusinesses, shouldSimulateFailure } from "./mock-data";
import type { GooglePlacesClient, MappedBusiness, PlaceSearchParams } from "./types";

const MOCK_LATENCY_MS = 400;
const MOCK_FAILURE_RATE = 0.05;

export function createMockGooglePlacesClient(): GooglePlacesClient {
  return {
    async search(params: PlaceSearchParams): Promise<MappedBusiness[]> {
      await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

      if (shouldSimulateFailure(MOCK_FAILURE_RATE)) {
        throw new Error("Simulated Google Places API failure (mock mode)");
      }

      return generateMockBusinesses(params);
    },
  };
}
