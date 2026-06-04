// Shared product/address API helpers used by the create and edit listing pages.
import type { ApiResponse } from "@/types/common";
import type { AddressResponse, CreateAddressRequest } from "@/types/address";
import type { ItemImageResponse, ProductPhoto } from "@/types/item";

/** True when a photo is a freshly added File (not an already-stored image). */
function isNewPhoto(photo: ProductPhoto): photo is File {
  return photo instanceof File;
}

/** Fetches the authenticated user's saved addresses (empty array on failure). */
async function fetchAddresses(): Promise<AddressResponse[]> {
  const res = await fetch("/api/addresses", { credentials: "include" });
  const json = (await res.json()) as ApiResponse<AddressResponse[]>;
  return json.data ?? [];
}

/** Creates and returns a new address for the authenticated user. */
async function createAddress(req: CreateAddressRequest): Promise<AddressResponse> {
  const res = await fetch("/api/addresses", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const json = (await res.json()) as ApiResponse<AddressResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al guardar la dirección");
  }
  return json.data;
}

/** Uploads photo files for an item and returns the stored image records. */
async function uploadItemImages(itemId: string, photos: File[]): Promise<ItemImageResponse[]> {
  const form = new FormData();
  for (const file of photos) form.append("images", file);

  const res = await fetch(`/api/items/${itemId}/images`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = (await res.json()) as ApiResponse<ItemImageResponse[]>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al subir las imágenes");
  }
  return json.data;
}

export { isNewPhoto, fetchAddresses, createAddress, uploadItemImages };
