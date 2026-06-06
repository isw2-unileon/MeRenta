import { expect, test } from "@playwright/test";

import { apiResponse, fulfillJson, mockGuestSession, mockMarketplaceApi, mockUser } from "./fixtures";

test.describe("Login Tests", () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestSession(page);
    await mockMarketplaceApi(page);
  });

  test("should login successfully with valid credentials", async ({ page }) => {
    await page.route("**/api/auth/login", (route) => fulfillJson(route, apiResponse({ customer: mockUser() })));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Iniciar sesi/i }).click();

    await expect(page).toHaveURL(/\/auth$/);

    await page.locator("#login-email").fill("lucia@merenta.test");
    await page.locator("#login-password").fill("password123");
    await page.locator("form").getByRole("button", { name: /Iniciar sesi/i }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText("Lucia G.")).toBeVisible();
  });
});
