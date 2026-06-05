import { describe, expect, it } from "vitest";

import type { AddressResponse } from "@/types/address";
import type { CustomerPublic } from "@/types/customer";
import {
  addressReducer,
  addressToDraft,
  createInitialProfileState,
  initialAddressState,
  profileReducer,
  validateAddressDraft,
} from "./ProfileEdit.logic";

const user: CustomerPublic = {
  customer_id: "customer-1",
  first_name: "Lucia",
  last_name: "Garcia",
  email: "lucia@example.com",
  phone: "600111222",
  avatar_url: "/avatar.jpg",
  registration_date: "2026-01-01T00:00:00Z",
  account_status: "active",
  user_role: "customer",
  verification_status: "verified",
};

const address: AddressResponse = {
  address_id: "address-1",
  customer_id: "customer-1",
  street: "Calle Ancha",
  number: "10",
  floor: "2B",
  city: "Leon",
  province: "Leon",
  postal_code: "24003",
  country: "Spain",
  latitude: 42.6,
  longitude: -5.57,
};

describe("ProfileEdit reducers", () => {
  it("hydrates profile state from the authenticated user", () => {
    const dirtyState = {
      ...createInitialProfileState(),
      firstName: "Temporal",
      saveError: "Error previo",
      saveMessage: "Mensaje previo",
      avatarPreviewUrl: "blob:avatar",
    };

    const next = profileReducer(dirtyState, { type: "hydrate_user", payload: user });

    expect(next).toMatchObject({
      firstName: "Lucia",
      lastName: "Garcia",
      email: "lucia@example.com",
      confirmEmail: "lucia@example.com",
      phone: "600111222",
      avatarUrl: "/avatar.jpg",
      avatarPreviewUrl: "",
      saveError: "",
      saveMessage: "",
    });
  });

  it("opens an address for editing and maps it into the draft", () => {
    const next = addressReducer(initialAddressState, { type: "open_edit", payload: address });

    expect(next.showEditor).toBe(true);
    expect(next.editingId).toBe("address-1");
    expect(next.draft).toEqual(addressToDraft(address));
  });

  it("upserts existing addresses without duplicating them", () => {
    const loaded = addressReducer(initialAddressState, { type: "load_success", payload: [address] });
    const updated = { ...address, city: "Astorga" };

    const next = addressReducer(loaded, { type: "upsert", payload: updated });

    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.city).toBe("Astorga");
  });

  it("validates required address fields", () => {
    const errors = validateAddressDraft({
      street: " ",
      number: "",
      city: "",
      province: "",
      postal_code: "",
      country: "Spain",
    });

    expect(errors).toEqual({
      street: "Obligatorio",
      number: "Obligatorio",
      city: "Obligatorio",
      province: "Obligatorio",
      postal_code: "Obligatorio",
    });
  });
});
