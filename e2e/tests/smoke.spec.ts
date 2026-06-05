import { expect, test } from "@playwright/test";

test.describe("runtime smoke checks", () => {
  test("backend health endpoint responds", async ({ request }) => {
    const response = await request.get("http://localhost:8080/health");

    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
