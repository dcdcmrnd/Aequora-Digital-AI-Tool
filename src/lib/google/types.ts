import { z } from "zod";

export const placeSearchParamsSchema = z.object({
  keyword: z.string().min(1),
  location: z.string().min(1),
  radiusMeters: z.number().int().positive().max(50_000).default(5_000),
  maxResults: z.number().int().positive().max(20).default(20),
});
export type PlaceSearchParams = z.infer<typeof placeSearchParamsSchema>;

/** Business shape mapped from the Places API, independent of the DB row. */
export interface MappedBusiness {
  googlePlaceId: string;
  name: string;
  category: string | null;
  businessStatus: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
}

export interface GooglePlacesClient {
  search(params: PlaceSearchParams): Promise<MappedBusiness[]>;
}

/** Subset of the Places API (New) `places:searchText` response we consume. */
const addressComponentSchema = z.object({
  longText: z.string(),
  shortText: z.string().optional(),
  types: z.array(z.string()),
});

const placeSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }).optional(),
  primaryTypeDisplayName: z.object({ text: z.string() }).optional(),
  businessStatus: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  internationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  formattedAddress: z.string().optional(),
  addressComponents: z.array(addressComponentSchema).optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
});
export type PlaceApiPlace = z.infer<typeof placeSchema>;

export const placeApiResponseSchema = z.object({
  places: z.array(placeSchema).optional(),
});
export type PlaceApiResponse = z.infer<typeof placeApiResponseSchema>;
