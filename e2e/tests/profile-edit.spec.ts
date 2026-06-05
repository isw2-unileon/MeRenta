import { expect, test, type Page } from "@playwright/test";

import { apiResponse, fulfillJson, mockAuthenticatedSession, mockUser } from "./fixtures";

const baseAddress = {
  address_id: "address-user-1",
  customer_id: "customer-1",
  street: "Gran Via",
  number: "1",
  floor: "2A",
  city: "Madrid",
  province: "Madrid",
  postal_code: "28013",
  country: "Spain",
};

async function mockProfileEditApi(page: Page) {
  await page.route("**/api/items/mine**", (route) =>
    fulfillJson(
      route,
      apiResponse({
        items: [],
        total: 0,
        page: 1,
        limit: 12,
        category_counts: {},
        city_counts: {},
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
        summary: { average_rating: 0, total: 0, distribution: {} },
      })
    )
  );
}

test.describe("profile edit", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockProfileEditApi(page);
  });

  test("validates email confirmation and password confirmation before saving", async ({ page }) => {
    let emailRequests = 0;
    let passwordRequests = 0;
    await page.route("**/api/me/email", (route) => {
      emailRequests += 1;
      return fulfillJson(route, apiResponse(mockUser()));
    });
    await page.route("**/api/me/password", (route) => {
      passwordRequests += 1;
      return fulfillJson(route, apiResponse({}));
    });

    await page.goto("/profile/edit");
    await page.getByLabel("Nuevo email").fill("nueva@merenta.test");
    await page.getByLabel("Confirmar email").fill("otra@merenta.test");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText(/email.*confirmaci/i)).toBeVisible();
    expect(emailRequests).toBe(0);

    await page.getByLabel("Nuevo email").fill("lucia@merenta.test");
    await page.getByLabel("Confirmar email").fill("lucia@merenta.test");
    await page.locator("[name='profile-current-secret']").fill("actual123");
    await page.locator("[name='profile-new-secret']").fill("password123");
    await page.locator("[name='profile-confirm-secret']").fill("password456");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText(/nueva contrase.*confirmaci/i)).toBeVisible();
    expect(passwordRequests).toBe(0);
  });

  test("creates, edits and deletes a saved address", async ({ page }) => {
    const addresses = [baseAddress];
    const requests: Array<{ method: string; url: string; body?: unknown }> = [];

    await page.route("**/api/addresses", async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        return fulfillJson(route, apiResponse(addresses));
      }
      requests.push({ method: request.method(), url: request.url(), body: request.postDataJSON() });
      const created = {
        ...baseAddress,
        ...request.postDataJSON(),
        address_id: "address-user-2",
      };
      addresses.push(created);
      return fulfillJson(route, apiResponse(created));
    });

    await page.route("**/api/addresses/*", async (route) => {
      const request = route.request();
      requests.push({ method: request.method(), url: request.url(), body: request.postDataJSON() });
      const addressId = request.url().split("/").pop() ?? "";
      if (request.method() === "PATCH") {
        const updated = { ...addresses.find((address) => address.address_id === addressId), ...request.postDataJSON() };
        const index = addresses.findIndex((address) => address.address_id === addressId);
        if (index >= 0) addresses[index] = updated;
        return fulfillJson(route, apiResponse(updated));
      }
      if (request.method() === "DELETE") {
        const index = addresses.findIndex((address) => address.address_id === addressId);
        if (index >= 0) addresses.splice(index, 1);
        return fulfillJson(route, apiResponse({ message: "deleted" }));
      }
      return route.fallback();
    });

    await page.goto("/profile/edit");
    await page.getByRole("button", { name: /Nueva direcci/i }).click();
    await page.getByLabel("Calle").fill("Calle Atocha");
    await page.getByLabel(/N.mero/i).fill("22");
    await page.getByLabel(/C.digo postal/i).fill("28012");
    await page.getByLabel("Ciudad").fill("Madrid");
    await page.getByLabel("Provincia").fill("Madrid");
    await page.getByRole("button", { name: /Guardar direcci/i }).click();

    await expect(page.getByText("Calle Atocha 22")).toBeVisible();

    await page.getByRole("button", { name: "Editar" }).last().click();
    await page.getByLabel("Calle").fill("Calle Mayor");
    await page.getByRole("button", { name: /Guardar direcci/i }).click();

    await expect(page.getByText("Calle Mayor 22")).toBeVisible();

    await page.getByRole("button", { name: "Quitar" }).last().click();
    await expect(page.getByText("Calle Mayor 22")).toHaveCount(0);

    expect(requests.map((request) => request.method)).toEqual(["POST", "PATCH", "DELETE"]);
  });

  test("shows profile API errors and success messages", async ({ page }) => {
    let shouldFail = true;
    await page.route("**/api/addresses", (route) => fulfillJson(route, apiResponse([baseAddress])));
    await page.route("**/api/me", async (route) => {
      const request = route.request();
      if (request.method() === "GET") return fulfillJson(route, apiResponse(mockUser()));
      if (request.method() === "PATCH" && shouldFail) {
        shouldFail = false;
        return fulfillJson(route, { success: false, error: "perfil no guardado" }, 500);
      }
      if (request.method() === "PATCH") return fulfillJson(route, apiResponse({ ...mockUser(), first_name: "Luci" }));
      return route.fallback();
    });

    await page.goto("/profile/edit");
    await page.getByLabel("Nombre").fill("Luci");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("perfil no guardado")).toBeVisible();

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText(/Cambios guardados correctamente/i)).toBeVisible();
  });
});
