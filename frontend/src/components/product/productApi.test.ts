import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAddress,
  fetchAddresses,
  isNewPhoto,
  reportFormErrors,
  uploadItemImages,
} from "@/components/product/productApi";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function mockFetch(response: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(response),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("productApi", () => {
  it("detects newly added File photos", () => {
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
    expect(isNewPhoto(file)).toBe(true);
    expect(isNewPhoto({ image_id: "1", image_url: "/stored.jpg", display_order: 0 })).toBe(false);
  });

  it("reports form errors and scrolls the first invalid field", () => {
    const field = document.createElement("div");
    field.id = "title";
    const scrollIntoView = vi.fn();
    field.scrollIntoView = scrollIntoView;
    document.body.appendChild(field);
    const onErrors = vi.fn();

    expect(reportFormErrors({ title: "Obligatorio", price: "Incorrecto" }, onErrors)).toBe(true);
    expect(onErrors).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("does not report when the error map is empty", () => {
    const onErrors = vi.fn();

    expect(reportFormErrors({}, onErrors)).toBe(false);
    expect(onErrors).not.toHaveBeenCalled();
  });

  it("loads addresses and falls back to an empty array when data is missing", async () => {
    mockFetch({ success: true, data: [{ address_id: "a1", city: "Leon" }] });
    await expect(fetchAddresses()).resolves.toEqual([{ address_id: "a1", city: "Leon" }]);

    mockFetch({ success: false });
    await expect(fetchAddresses()).resolves.toEqual([]);
  });

  it("creates addresses with JSON credentials and unwraps the response", async () => {
    const payload = { city: "Leon", province: "Leon", postal_code: "24001", street: "Calle Luna", number: "1" };
    const fetchMock = mockFetch({ success: true, data: { address_id: "a1", ...payload } });

    await expect(createAddress(payload)).resolves.toMatchObject({ address_id: "a1" });
    expect(fetchMock).toHaveBeenCalledWith("/api/addresses", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("throws API messages from failed address creation and image uploads", async () => {
    mockFetch({ success: false, error: "direccion invalida" }, false);
    await expect(
      createAddress({ city: "Leon", province: "Leon", postal_code: "24001", street: "Calle Luna", number: "1" })
    ).rejects.toThrow("direccion invalida");

    mockFetch({ success: false, message: "imagenes invalidas" }, false);
    await expect(uploadItemImages("item-1", [new File(["x"], "x.png")])).rejects.toThrow("imagenes invalidas");
  });

  it("uploads item images as FormData", async () => {
    const fetchMock = mockFetch({ success: true, data: [{ image_id: "img-1" }] });

    await expect(uploadItemImages("item-1", [new File(["x"], "x.png")])).resolves.toEqual([{ image_id: "img-1" }]);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock).toHaveBeenCalledWith("/api/items/item-1/images", expect.objectContaining({ method: "POST" }));
    expect(init.body).toBeInstanceOf(FormData);
  });
});
