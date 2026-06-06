import { expect, test } from "@playwright/test";

import { apiResponse, fulfillJson, mockGuestSession, mockMarketplaceApi, mockUser } from "./fixtures";

test.describe("authentication", () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestSession(page);
    await mockMarketplaceApi(page);
  });

  test("login validates required fields without calling the API", async ({ page }) => {
    let loginRequests = 0;
    await page.route("**/api/auth/login", (route) => {
      loginRequests += 1;
      return fulfillJson(route, apiResponse({ customer: mockUser() }));
    });

    await page.goto("/auth");
    await page.locator("#login-email").fill("lucia@merenta.test");
    await page.locator("#login-email").fill("");
    await page.locator("button[type='submit']").click();

    await expect(page.locator("#login-email")).toBeFocused();
    expect(loginRequests).toBe(0);
  });

  test("logs in and opens the authenticated home", async ({ page }) => {
    await page.route("**/api/auth/login", (route) => fulfillJson(route, apiResponse({ customer: mockUser() })));

    await page.goto("/auth");
    await page.locator("#login-email").fill("lucia@merenta.test");
    await page.locator("#login-password").fill("password123");
    await page.locator("button[type='submit']").click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("navigation").getByRole("button", { name: "Me Renta" })).toBeVisible();
    await expect(page.getByText("Lucia G.")).toBeVisible();
  });

  test("registers a new account and redirects home", async ({ page }) => {
    await page.route("**/api/auth/register", (route) => fulfillJson(route, apiResponse({ customer: mockUser() })));

    await page.goto("/auth");
    await page.getByRole("button", { name: /Crear cuenta/i }).click();
    await page.locator("#register-name").fill("Lucia");
    await page.locator("#register-last-name").fill("Garcia");
    await page.locator("#register-email").fill("lucia.nueva@merenta.test");
    await page.locator("#register-password").fill("password123");
    await page.locator("#register-repeat-password").fill("password123");
    await page.locator("form").getByRole("button", { name: /^Crear cuenta$/i }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText("Lucia G.")).toBeVisible();
  });

  test("shows backend login errors to the user", async ({ page }) => {
    await page.route("**/api/auth/login", (route) =>
      fulfillJson(
        route,
        {
          success: false,
          error: "credenciales invalidas",
        },
        401
      )
    );

    await page.goto("/auth");
    await page.locator("#login-email").fill("lucia@merenta.test");
    await page.locator("#login-password").fill("wrong-password");
    await page.locator("button[type='submit']").click();

    await expect(page.getByText("credenciales invalidas")).toBeVisible();
  });
});
