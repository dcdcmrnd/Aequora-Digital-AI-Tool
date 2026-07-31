import { createGooglePlacesClient, placeSearchParamsSchema } from "@/lib/google";
import type { MappedBusiness, PlaceSearchParams } from "@/lib/google";
import { withRetry } from "@/lib/utils/retry";

export async function searchBusinesses(params: PlaceSearchParams): Promise<MappedBusiness[]> {
  const validated = placeSearchParamsSchema.parse(params);
  const client = createGooglePlacesClient();

  return withRetry(() => client.search(validated));
}
