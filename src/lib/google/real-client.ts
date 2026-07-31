import { mapPlaceToBusiness } from "./mapper";
import { placeApiResponseSchema } from "./types";
import type { GooglePlacesClient, MappedBusiness, PlaceSearchParams } from "./types";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
].join(",");

export function createRealGooglePlacesClient(): GooglePlacesClient {
  return {
    async search(params: PlaceSearchParams): Promise<MappedBusiness[]> {
      const response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY ?? "",
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: `${params.keyword} in ${params.location}`,
          maxResultCount: params.maxResults,
        }),
      });

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      const parsed = placeApiResponseSchema.parse(json);

      return (parsed.places ?? []).map(mapPlaceToBusiness);
    },
  };
}
