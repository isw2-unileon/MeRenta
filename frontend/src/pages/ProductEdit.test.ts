import { describe, expect, it, vi } from "vitest";

import type { ItemImageResponse, ItemResponse, ProductFormData } from "@/types/item";
import { EMPTY_FORM, formDataToPayload, formatRelativeDate, itemToFormData, validateForm } from "./ProductEdit.logic";

const item: ItemResponse = {
  item_id: "item-1",
  owner_id: "owner-1",
  address_id: "address-1",
  category: "tools",
  title: "Sierra circular",
  description: "Sierra circular revisada y lista para cortes de madera.",
  usage_rules: "Usar con gafas de seguridad.",
  condition: "good",
  item_status: "available",
  price_per_day: 18,
  deposit: 40,
  min_days: 2,
  max_days: null,
  is_available: true,
  published_at: "2026-06-01T10:00:00Z",
  city: "Leon",
  province: "Leon",
  postal_code: "24001",
};

describe("ProductEdit form logic", () => {
  it("maps an item response and sorted images into form data", () => {
    const images: ItemImageResponse[] = [
      { image_id: "img-2", item_id: "item-1", image_url: "/2.jpg", display_order: 2 },
      { image_id: "img-1", item_id: "item-1", image_url: "/1.jpg", display_order: 1 },
    ];

    const form = itemToFormData(item, images);

    expect(form.title).toBe("Sierra circular");
    expect(form.address).toBe("address-1");
    expect(form.maxRentalPeriod).toBe("0");
    expect(form.photos).toEqual([
      { image_id: "img-1", image_url: "/1.jpg", display_order: 1 },
      { image_id: "img-2", image_url: "/2.jpg", display_order: 2 },
    ]);
  });

  it("builds the update payload with trimmed text and withdrawn status", () => {
    const form: ProductFormData = {
      ...EMPTY_FORM,
      title: "  Sierra circular  ",
      category: "tools",
      condition: "good",
      description: "  Cortes limpios en madera  ",
      usageRules: "  Devolver limpia  ",
      pricePerDay: "18.5",
      deposit: "",
      minRentalPeriod: "2",
      maxRentalPeriod: "0",
      address: "address-1",
      availableNow: false,
      photos: [{ image_id: "img-1", image_url: "/1.jpg", display_order: 1 }],
    };

    expect(formDataToPayload(form)).toEqual({
      address_id: "address-1",
      category: "tools",
      condition: "good",
      title: "Sierra circular",
      description: "Cortes limpios en madera",
      usage_rules: "Devolver limpia",
      price_per_day: 18.5,
      deposit: undefined,
      min_days: 2,
      max_days: undefined,
      is_available: false,
      item_status: "withdrawn",
    });
  });

  it("validates product edit required fields and rental period order", () => {
    const errors = validateForm({
      ...EMPTY_FORM,
      minRentalPeriod: "5",
      maxRentalPeriod: "2",
    });

    expect(errors.title).toBeTruthy();
    expect(errors.pricePerDay).toBeTruthy();
    expect(errors.minRentalPeriod).toBeTruthy();
    expect(errors.maxRentalPeriod).toBeTruthy();
  });

  it("formats relative publication dates", () => {
    vi.setSystemTime(new Date("2026-06-05T12:00:00Z"));

    expect(formatRelativeDate("2026-06-05T08:00:00Z")).toBe("hoy");
    expect(formatRelativeDate("2026-06-04T12:00:00Z")).toBe("hace 1 dia");
    expect(formatRelativeDate("bad-date")).toBe("");

    vi.useRealTimers();
  });
});
