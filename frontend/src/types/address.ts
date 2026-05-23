/** A customer's saved home / pick-up address returned by the API. */
interface AddressResponse {
  address_id: string;
  customer_id: string;
  street: string;
  number: string;
  floor?: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

/** Payload for POST /api/addresses. */
interface CreateAddressRequest {
  street: string;
  number: string;
  floor?: string;
  city: string;
  province: string;
  postal_code: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export type { AddressResponse, CreateAddressRequest };
