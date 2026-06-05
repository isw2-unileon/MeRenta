import { expect, test } from "@playwright/test";

import { mockGuestSession, mockMarketplaceApi } from "./fixtures";

test.describe("public experience", () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestSession(page);
    await mockMarketplaceApi(page);
  });

  test("landing page renders marketplace content and primary entry points", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Alquila lo que necesitas");
    await expect(page.getByText("Bicicleta urbana")).toBeVisible();
    await expect(page.getByText("Camara mirrorless")).toBeVisible();

    await page.getByRole("button", { name: /Empieza ahora/i }).click();
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.locator("#register-email")).toBeVisible();
  });

  test("unknown routes land on the not-found page", async ({ page }) => {
    await page.goto("/ruta-inexistente");

    await expect(page).toHaveURL(/\/not-found$/);
    await expect(page.getByRole("main")).toBeVisible();
  });
});
