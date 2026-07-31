import type { MappedBusiness, PlaceApiPlace } from "./types";

const COMPONENT_TYPE_TO_FIELD = {
  locality: "city",
  administrative_area_level_1: "state",
  country: "country",
} as const;

function extractAddressComponents(place: PlaceApiPlace) {
  const result: { city: string | null; state: string | null; country: string | null } = {
    city: null,
    state: null,
    country: null,
  };

  for (const component of place.addressComponents ?? []) {
    for (const type of component.types) {
      const field = COMPONENT_TYPE_TO_FIELD[type as keyof typeof COMPONENT_TYPE_TO_FIELD];
      if (field) {
        result[field] = component.longText;
      }
    }
  }

  return result;
}

export function mapPlaceToBusiness(place: PlaceApiPlace): MappedBusiness {
  const { city, state, country } = extractAddressComponents(place);

  return {
    googlePlaceId: place.id,
    name: place.displayName?.text ?? "Unknown business",
    category: place.primaryTypeDisplayName?.text ?? null,
    businessStatus: place.businessStatus ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? 0,
    address: place.formattedAddress ?? null,
    city,
    state,
    country,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
  };
}
