import { expect, test } from "@playwright/test";

import { mockAuthenticatedSession, searchPayload } from "./fixtures";

test.describe("authenticated marketplace", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
  });

  test("home shows personalized marketplace sections and navigates to search", async ({ page }) => {
    await page.goto("/home");

    await expect(page.getByRole("heading", { name: /necesitas hoy/i })).toBeVisible();
    await expect(page.getByText("Tus favoritos")).toBeVisible();
    await expect(page.getByText("Bicicleta urbana").first()).toBeVisible();
    await expect(page.getByText("Camara mirrorless").first()).toBeVisible();

    await page.getByLabel("Buscar productos").fill("bicicleta");
    await page.getByRole("button", { name: /^Buscar$/i }).click();

    await expect(page).toHaveURL(/\/search\?q=bicicleta/);
  });

  test("search lists products, applies filters and keeps URL state", async ({ page }) => {
    const itemRequests: string[] = [];
    await page.route("**/api/items**", async (route) => {
      itemRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ success: true, data: searchPayload }),
      });
    });

    await page.goto("/search");

    await expect(page.getByText("2 productos disponibles")).toBeVisible();
    await expect(page.getByText("Bicicleta urbana")).toBeVisible();
    await expect(page.getByText("Camara mirrorless")).toBeVisible();

    await page.getByLabel(/Deportes/i).click();
    await expect(page).toHaveURL(/category=sports/);

    await page.getByLabel(/Precio.*n/i).fill("10");
    await expect(page).toHaveURL(/min_price=10/);

    expect(itemRequests.some((url) => url.includes("category=sports"))).toBeTruthy();
  });

  test("favorite toggles optimistically on product cards", async ({ page }) => {
    await page.goto("/search");

    const firstFavoriteButton = page.getByRole("button", { name: "Guardar favorito" }).first();
    await firstFavoriteButton.click();

    await expect(page.getByRole("button", { name: "Quitar de favoritos" }).first()).toBeVisible();
  });
});
