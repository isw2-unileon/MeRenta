import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Alquila lo que necesitas, gana con lo que tienes");
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("http://localhost:8080/health");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ status: "ok" });
});
