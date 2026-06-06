import { expect, test, type Page } from "@playwright/test";

import { apiResponse, bikeItem, fulfillJson, mockAuthenticatedSession, mockUser } from "./fixtures";

async function mockProfileOverviewApi(page: Page) {
  await page.route("**/api/items/mine**", (route) =>
    fulfillJson(
      route,
      apiResponse({
        items: [bikeItem],
        total: 1,
        page: 1,
        limit: 48,
        category_counts: { sports: 1 },
        city_counts: { Madrid: 1 },
        condition_counts: {},
      })
    )
  );
  await page.route("**/api/reviews/received**", (route) =>
    fulfillJson(
      route,
      apiResponse({
        items: [],
        total: 0,
        page: 1,
        limit: 4,
        summary: { average_rating: 0, total: 0, distribution: {} },
      })
    )
  );
}

test.describe("my profile", () => {
  test("requests profile verification and locks the action while pending", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockProfileOverviewApi(page);
    await page.route("**/api/me", (route) =>
      fulfillJson(route, apiResponse({ ...mockUser(), verification_status: "none" }))
    );
    const verificationRequestPromise = page.waitForRequest(
      (request) => request.url().endsWith("/api/me/verification-request") && request.method() === "POST"
    );
    await page.route("**/api/me/verification-request", (route) =>
      fulfillJson(route, apiResponse({ verification_status: "pending" }))
    );

    await page.goto("/profile");
    await expect(page.getByText("Bicicleta urbana").first()).toBeVisible();

    await page.getByRole("button", { name: /Solicitar badge verificado/i }).click();
    await verificationRequestPromise;

    await expect(page.getByRole("button", { name: /Solicitud pendiente/i })).toBeDisabled();
    await expect(page.getByText(/solicitud esta en revision/i)).toBeVisible();
  });

  test("shows verification request API errors without changing the action state", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockProfileOverviewApi(page);
    await page.route("**/api/me", (route) =>
      fulfillJson(route, apiResponse({ ...mockUser(), verification_status: "rejected" }))
    );
    await page.route("**/api/me/verification-request", (route) =>
      fulfillJson(route, { success: false, error: "documentacion incompleta" }, 400)
    );

    await page.goto("/profile");
    await page.getByRole("button", { name: /Solicitar de nuevo/i }).click();

    await expect(page.getByText("documentacion incompleta")).toBeVisible();
    await expect(page.getByRole("button", { name: /Solicitar de nuevo/i })).toBeEnabled();
  });
});
