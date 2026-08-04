import { mapPlaceToBusiness } from "./mapper";
import { placeApiResponseSchema } from "./types";
import type { GooglePlacesClient, MappedBusiness, PlaceSearchParams } from "./types";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Google documents a short delay before a freshly-issued nextPageToken becomes usable.
const PAGE_TOKEN_DELAY_MS = 2_000;

// nextPageToken here is correct per Google's docs — the earlier 400 was caused by
// pairing it with the request body's now-deprecated `maxResultCount` field instead
// of `pageSize` (confirmed against Google's official Text Search pagination example).
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
  "nextPageToken",
].join(",");

export function createRealGooglePlacesClient(): GooglePlacesClient {
  return {
    // Google's Text Search caps each request at maxResults (<=20). To gather up to
    // targetResults, this pages through with nextPageToken until it either hits that
    // target or Google runs out of pages.
    async search(params: PlaceSearchParams): Promise<MappedBusiness[]> {
      const perPage = Math.min(params.maxResults, 20);
      const target = Math.max(params.targetResults, perPage);
      const collected: MappedBusiness[] = [];
      let pageToken: string | undefined;

      do {
        const body = pageToken
          ? { pageToken }
          : { textQuery: `${params.keyword} in ${params.location}`, pageSize: perPage };

        const response = await fetch(SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY ?? "",
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          console.error("Google Places API error", response.status, errorBody);
          throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        const parsed = placeApiResponseSchema.parse(json);
        collected.push(...(parsed.places ?? []).map(mapPlaceToBusiness));
        pageToken = parsed.nextPageToken;

        if (pageToken && collected.length < target) {
          await new Promise((resolve) => setTimeout(resolve, PAGE_TOKEN_DELAY_MS));
        }
      } while (pageToken && collected.length < target);

      return collected.slice(0, target);
    },
  };
}
