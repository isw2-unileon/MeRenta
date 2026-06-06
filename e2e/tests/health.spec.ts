import { expect, test } from "@playwright/test";

import { mockGuestSession, mockMarketplaceApi } from "./fixtures";

test("homepage loads", async ({ page }) => {
  await mockGuestSession(page);
  await mockMarketplaceApi(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Alquila lo que necesitas");
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("http://localhost:8080/health");

  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ status: "ok" });
});
