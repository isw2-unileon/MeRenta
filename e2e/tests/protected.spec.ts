import { expect, test } from "@playwright/test";

import { apiResponse, fulfillJson, mockAuthenticatedSession, mockGuestSession } from "./fixtures";

test.describe("route guards", () => {
  test("redirects guests from private pages to auth", async ({ page }) => {
    await mockGuestSession(page);

    await page.goto("/home");

    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("redirects a customer away from the admin panel", async ({ page }) => {
    await mockAuthenticatedSession(page);

    await page.goto("/admin");

    await expect(page).toHaveURL(/\/403$/);
  });

  test("allows admins into the admin panel", async ({ page }) => {
    await mockAuthenticatedSession(page, { role: "admin" });
    await page.route("**/api/admin/stats", (route) =>
      fulfillJson(
        route,
        apiResponse({
          users: 1,
          products: 0,
          bookings: { total: 0, pending: 0, accepted: 0, rejected: 0, cancelled: 0, completed: 0 },
          revenue: 0,
          monthly_revenue: [],
          categories: [],
          incidents: { open: 0, under_review: 0 },
          recent_incidents: [],
        })
      )
    );
    await page.route("**/api/admin/incidents**", (route) =>
      fulfillJson(route, apiResponse({ items: [], total: 0, page: 1, limit: 1 }))
    );
    await page.route("**/api/admin/items**", (route) =>
      fulfillJson(
        route,
        apiResponse({
          items: [],
          total: 0,
          page: 1,
          limit: 1,
          category_counts: {},
          city_counts: {},
          condition_counts: {},
        })
      )
    );
    await page.route("**/api/admin/verification**", (route) =>
      fulfillJson(route, apiResponse({ requests: [], total: 0, page: 1, limit: 1 }))
    );

    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  });

  test("redirects banned accounts to the blocked-account page", async ({ page }) => {
    await page.route("**/api/me", (route) =>
      fulfillJson(
        route,
        {
          success: false,
          error: "account_banned",
        },
        403
      )
    );

    await page.goto("/home");

    await expect(page).toHaveURL(/\/banned$/);
  });

  test("logs out and leaves private pages", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await page.route("**/api/auth/logout", (route) => fulfillJson(route, apiResponse({})));

    await page.goto("/home");
    await page.getByRole("button", { name: /Cerrar/i }).click();

    await expect(page).toHaveURL(/\/auth$/);
  });
});
