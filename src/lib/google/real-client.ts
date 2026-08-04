import { mapPlaceToBusiness } from "./mapper";
import { placeApiResponseSchema } from "./types";
import type { GooglePlacesClient, MappedBusiness, PlaceSearchParams } from "./types";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Google documents a short delay before a freshly-issued nextPageToken becomes usable.
const PAGE_TOKEN_DELAY_MS = 2_000;

// Places API (New) strictly filters the response to only what's listed here —
// omitting nextPageToken means Google never returns one, silently breaking pagination.
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
          : { textQuery: `${params.keyword} in ${params.location}`, maxResultCount: perPage };

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
