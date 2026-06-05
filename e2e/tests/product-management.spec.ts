import { expect, test, type Page } from "@playwright/test";

import { apiResponse, fulfillJson, mockAuthenticatedSession, mockUser } from "./fixtures";

const savedAddress = {
  address_id: "address-user-1",
  customer_id: "customer-1",
  street: "Gran Via",
  number: "1",
  floor: "",
  city: "Madrid",
  province: "Madrid",
  postal_code: "28013",
  country: "Spain",
};

const editableItem = {
  item_id: "item-owned-1",
  owner_id: "customer-1",
  address_id: savedAddress.address_id,
  category: "sports",
  title: "Bicicleta plegable",
  description:
    "Bicicleta plegable con cambios revisados, luces incluidas, candado y casco para alquiler urbano seguro.",
  usage_rules: "Devolver limpia y con el candado.",
  condition: "good",
  item_status: "available",
  price_per_day: 18,
  deposit: 50,
  min_days: 1,
  max_days: 30,
  is_available: true,
  published_at: "2026-05-20T10:00:00Z",
  city: "Madrid",
  province: "Madrid",
  postal_code: "28013",
};

async function mockProductCommonApi(page: Page) {
  await page.route("**/api/addresses", async (route) => {
    const request = route.request();
    if (request.method() === "GET") return fulfillJson(route, apiResponse([savedAddress]));
    return fulfillJson(route, apiResponse({ ...savedAddress, ...request.postDataJSON(), address_id: "address-new-1" }));
  });
  await page.route("**/api/customers/*/profile", (route) =>
    fulfillJson(
      route,
      apiResponse({
        customer_id: "owner-1",
        first_name: "Marta",
        last_name: "Lopez",
        avatar_url: null,
        registration_date: "2025-01-01T00:00:00Z",
        verification_status: "verified",
      })
    )
  );
  await page.route("**/api/items/*/unavailable-dates", (route) => fulfillJson(route, apiResponse([])));
}

async function uploadProductPhoto(page: Page) {
  await page.getByLabel(/Subir fotos del producto/i).setInputFiles({
    name: "producto.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    ),
  });
}

async function fillValidProductForm(page: Page) {
  await page.getByLabel(/T.tulo del anuncio/i).fill("Bicicleta urbana premium");
  await page.locator("#category").selectOption("sports");
  await page.locator("#condition").selectOption("good");
  await page
    .getByLabel(/Descripci.n completa/i)
    .fill(
      "Bicicleta urbana premium en perfecto estado para moverse por la ciudad. Incluye casco, luces, candado reforzado, bomba de aire y cesta delantera. Se entrega revisada y lista para usar durante varios dias."
    );
  await uploadProductPhoto(page);
  await page.getByLabel(/Precio por d.a/i).fill("18");
  await page.getByLabel(/Direcci.n de recogida/i).selectOption(savedAddress.address_id);
}

test.describe("product create and edit pages", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockProductCommonApi(page);
  });

  test("validates required fields before creating a product", async ({ page }) => {
    let createRequests = 0;
    await page.route("**/api/items", (route) => {
      createRequests += 1;
      return fulfillJson(route, apiResponse(editableItem));
    });

    await page.goto("/product/new");
    await page.getByRole("button", { name: "Crear producto" }).click();

    await expect(page.getByText(/t.tulo es obligatorio/i)).toBeVisible();
    await expect(page.locator("p.field-error", { hasText: /Selecciona una categor/i })).toBeVisible();
    await expect(page.locator("p.field-error", { hasText: /A.*ade al menos una foto/i })).toBeVisible();
    expect(createRequests).toBe(0);
  });

  test("loads addresses and sends the final create payload", async ({ page }) => {
    let createPayload: unknown;
    let imagesUploaded = false;

    await page.route("**/api/items", async (route) => {
      createPayload = route.request().postDataJSON();
      return fulfillJson(route, apiResponse({ ...editableItem, item_id: "item-created-1", title: "Bicicleta urbana premium" }));
    });
    await page.route("**/api/items/item-created-1/images", (route) => {
      imagesUploaded = true;
      return fulfillJson(route, apiResponse([{ image_id: "image-1", item_id: "item-created-1", image_url: "", display_order: 0 }]));
    });
    await page.route("**/api/items/item-created-1", (route) =>
      fulfillJson(route, apiResponse({ ...editableItem, item_id: "item-created-1", title: "Bicicleta urbana premium" }))
    );
    await page.route("**/api/reviews/summary/*", (route) =>
      fulfillJson(route, apiResponse({ average_rating: 0, total: 0, distribution: {} }))
    );

    await page.goto("/product/new");
    await expect(page.getByLabel(/Direcci.n de recogida/i)).toContainText("Gran Via 1");
    await fillValidProductForm(page);
    await page.getByRole("button", { name: "Crear producto" }).click();

    await expect(page).toHaveURL(/\/product\/item-created-1$/);
    expect(createPayload).toMatchObject({
      address_id: savedAddress.address_id,
      category: "sports",
      condition: "good",
      title: "Bicicleta urbana premium",
      price_per_day: 18,
      deposit: 50,
      min_days: 1,
      max_days: 30,
    });
    expect(imagesUploaded).toBeTruthy();
  });

  test("edits product payload and deletes an owned product", async ({ page }) => {
    const requests: Array<{ method: string; url: string; body?: unknown }> = [];
    await page.route("**/api/items/item-owned-1", async (route) => {
      const request = route.request();
      requests.push({ method: request.method(), url: request.url(), body: request.postDataJSON() });
      if (request.method() === "GET") return fulfillJson(route, apiResponse(editableItem));
      if (request.method() === "PATCH") {
        return fulfillJson(route, apiResponse({ ...editableItem, ...request.postDataJSON(), title: "Bicicleta plegable actualizada" }));
      }
      if (request.method() === "DELETE") return fulfillJson(route, apiResponse({ message: "deleted" }));
      return route.fallback();
    });
    await page.route("**/api/items/item-owned-1/images", (route) =>
      fulfillJson(route, apiResponse([{ image_id: "image-1", item_id: "item-owned-1", image_url: "", display_order: 0 }]))
    );

    await page.goto("/product/item-owned-1/edit");
    await expect(page.getByLabel(/T.tulo del anuncio/i)).toHaveValue("Bicicleta plegable");
    await page.getByLabel(/T.tulo del anuncio/i).fill("Bicicleta plegable actualizada");
    await page.getByLabel(/Precio por d.a/i).fill("22");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText(/Cambios guardados correctamente/i)).toBeVisible();
    const patchRequest = requests.find((request) => request.method === "PATCH");
    expect(patchRequest?.body).toMatchObject({
      title: "Bicicleta plegable actualizada",
      price_per_day: 22,
      item_status: "available",
    });

    await page.getByRole("button", { name: /^Eliminar$/ }).click();
    await page.getByRole("button", { name: /Confirmar eliminaci/i }).click();
    await expect(page).toHaveURL(/\/profile$/);
    expect(requests.some((request) => request.method === "DELETE")).toBeTruthy();
  });

  test("does not save invalid edited products", async ({ page }) => {
    let patchRequests = 0;
    await page.route("**/api/items/item-owned-1", async (route) => {
      const request = route.request();
      if (request.method() === "PATCH") patchRequests += 1;
      return fulfillJson(route, apiResponse(editableItem));
    });
    await page.route("**/api/items/item-owned-1/images", (route) => fulfillJson(route, apiResponse([])));

    await page.goto("/product/item-owned-1/edit");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.locator("p.field-error", { hasText: /A.*ade al menos una foto/i })).toBeVisible();
    expect(patchRequests).toBe(0);
  });
});
