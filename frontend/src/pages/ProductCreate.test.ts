import { describe, expect, it } from "vitest";

import type { ProductFormData } from "@/types/item";
import { INITIAL_FORM, formReducer, validateForm } from "./ProductCreate.logic";

function validForm(overrides: Partial<ProductFormData> = {}): ProductFormData {
  return {
    ...INITIAL_FORM,
    title: "Taladro percutor Bosch",
    category: "tools",
    condition: "good",
    description: "Taladro percutor en buen estado, con maletin, brocas y bateria cargada para trabajos de bricolaje domestico.",
    photos: [new File(["photo"], "taladro.jpg", { type: "image/jpeg" })],
    pricePerDay: "12.5",
    minRentalPeriod: "1",
    maxRentalPeriod: "7",
    address: "address-1",
    ...overrides,
  };
}

describe("ProductCreate form logic", () => {
  it("validates required fields before creating a product", () => {
    const errors = validateForm(INITIAL_FORM);

    expect(errors.title).toBeTruthy();
    expect(errors.category).toBeTruthy();
    expect(errors.condition).toBeTruthy();
    expect(errors.description).toBeTruthy();
    expect(errors.pricePerDay).toBeTruthy();
    expect(errors.address).toBeTruthy();
    expect(errors.photos).toBeTruthy();
  });

  it("accepts an unlimited maximum rental period", () => {
    const errors = validateForm(validForm({ minRentalPeriod: "10", maxRentalPeriod: "0" }));

    expect(errors.minRentalPeriod).toBeUndefined();
    expect(errors.maxRentalPeriod).toBeUndefined();
  });

  it("rejects a minimum rental period greater than the maximum", () => {
    const errors = validateForm(validForm({ minRentalPeriod: "8", maxRentalPeriod: "3" }));

    expect(errors.minRentalPeriod).toBeTruthy();
    expect(errors.maxRentalPeriod).toBeTruthy();
  });

  it("keeps photos immutable when adding and removing them", () => {
    const first = new File(["a"], "a.jpg", { type: "image/jpeg" });
    const second = new File(["b"], "b.jpg", { type: "image/jpeg" });
    const state = {
      data: { ...INITIAL_FORM, photos: [first] },
      errors: { photos: "photos required" },
      submitStep: "idle" as const,
      submitError: "",
    };

    const withSecond = formReducer(state, { type: "add-photos", files: [second] });
    const withoutFirst = formReducer(withSecond, { type: "remove-photo", index: 0 });

    expect(state.data.photos).toEqual([first]);
    expect(withSecond.data.photos).toEqual([first, second]);
    expect(withoutFirst.data.photos).toEqual([second]);
  });
});
