import { expect, test, type Page } from "@playwright/test";

import { apiResponse, fulfillJson, mockAuthenticatedSession, mockUser } from "./fixtures";

const rentableItem = {
  item_id: "item-bike-1",
  owner_id: "owner-1",
  address_id: "address-1",
  category: "sports",
  title: "Bicicleta urbana",
  description:
    "Bicicleta urbana revisada, comoda y lista para alquileres cortos por Madrid con casco y candado incluidos.",
  usage_rules: "Usar en ciudad y devolver con candado.",
  condition: "good",
  item_status: "available",
  price_per_day: 18,
  deposit: 50,
  min_days: 1,
  max_days: 7,
  is_available: true,
  published_at: "2026-05-20T10:00:00Z",
  city: "Madrid",
  province: "Madrid",
  postal_code: "28013",
};

const adminIncident = {
  incident_id: "incident-1",
  rental_id: "rental-1",
  reporter_id: "customer-1",
  reporter_name: "Lucia Garcia",
  reported_id: "owner-1",
  reported_name: "Marta Lopez",
  booking_id: "booking-1",
  item_id: "item-bike-1",
  item_title: "Bicicleta urbana",
  start_date: "2026-06-10",
  end_date: "2026-06-12",
  type: "damage",
  description: "La bicicleta llego con el cambio roto.",
  status: "open",
  priority: "medium",
  associated_cost: 25,
  reported_at: "2026-06-04T09:00:00Z",
};

async function mockProductDetailApi(page: Page) {
  await page.route("**/api/items/item-bike-1", (route) => fulfillJson(route, apiResponse(rentableItem)));
  await page.route("**/api/items/item-bike-1/images", (route) => fulfillJson(route, apiResponse([])));
  await page.route("**/api/items/item-bike-1/unavailable-dates", (route) => fulfillJson(route, apiResponse([])));
  await page.route("**/api/customers/owner-1/profile", (route) =>
    fulfillJson(
      route,
      apiResponse({
        customer_id: "owner-1",
        first_name: "Marta",
        last_name: "Lopez",
        avatar_url: null,
        registration_date: "2025-01-01T00:00:00Z",
        verification_status: "verified",
      })
    )
  );
  await page.route("**/api/reviews/summary/owner-1", (route) =>
    fulfillJson(route, apiResponse({ average_rating: 4.8, total: 12, distribution: { "5": 10, "4": 2 } }))
  );
}

async function mockCheckoutApi(page: Page) {
  await mockProductDetailApi(page);
  await page.route("**/api/payment/intent", (route) =>
    fulfillJson(
      route,
      apiResponse({
        client_secret: "pi_test_secret_test",
        payment_intent_id: "pi_test",
        amount_eur: 46.6,
      })
    )
  );
  await page.route("**/api/bookings", (route) => fulfillJson(route, apiResponse({ booking_id: "booking-1" })));
}

async function mockChatApi(page: Page, options: { messagesFail?: boolean } = {}) {
  await page.addInitScript(() => {
    class MockSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 3;
      url: string;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;

      constructor(url: string) {
        super();
        this.url = url;
        setTimeout(() => this.onclose?.(new CloseEvent("close")), 0);
      }

      send() {}
      close() {
        this.readyState = 3;
        this.onclose?.(new CloseEvent("close"));
      }
    }
    window.WebSocket = MockSocket as unknown as typeof WebSocket;
  });

  await page.route("**/api/conversations", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      return fulfillJson(route, apiResponse({ conversation_id: "conv-1" }));
    }
    return fulfillJson(
      route,
      apiResponse({
        items: [
          {
            conversation_id: "conv-1",
            item_id: "item-bike-1",
            item_title: "Bicicleta urbana",
            item_price: 18,
            other_user_id: "owner-1",
            other_user_name: "Marta Lopez",
            other_avatar_url: "",
            other_user_verification_status: "verified",
            last_message: "Hola, esta disponible?",
            last_message_at: "2026-06-04T09:00:00Z",
            updated_at: "2026-06-04T09:00:00Z",
            unread_count: 1,
          },
        ],
        total: 1,
      })
    );
  });
  await page.route("**/api/conversations/conv-1/messages", async (route) => {
    const request = route.request();
    if (options.messagesFail && request.method() === "GET") {
      return fulfillJson(route, { success: false, error: "conversacion eliminada" }, 404);
    }
    if (request.method() === "POST") {
      return fulfillJson(
        route,
        apiResponse({
          message_id: "message-2",
          conversation_id: "conv-1",
          sender_id: "customer-1",
          body: request.postDataJSON().body,
          created_at: "2026-06-04T09:05:00Z",
          is_mine: true,
          is_read: false,
        })
      );
    }
    return fulfillJson(
      route,
      apiResponse({
        items: [
          {
            message_id: "message-1",
            conversation_id: "conv-1",
            sender_id: "owner-1",
            body: "Hola, esta disponible?",
            created_at: "2026-06-04T09:00:00Z",
            is_mine: false,
            is_read: false,
          },
        ],
        total: 1,
      })
    );
  });
  await page.route("**/api/conversations/conv-1/read", (route) => fulfillJson(route, apiResponse({})));
}

async function mockAdminApi(page: Page) {
  await page.route("**/api/admin/stats", (route) =>
    fulfillJson(
      route,
      apiResponse({
        users: 1,
        products: 1,
        bookings: { total: 1, pending: 0, accepted: 1, rejected: 0, cancelled: 0, completed: 0 },
        revenue: 46.6,
        monthly_revenue: [],
        categories: [],
        incidents: { open: 1, under_review: 0 },
        recent_incidents: [adminIncident],
      })
    )
  );
  await page.route("**/api/admin/incidents**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return fulfillJson(route, apiResponse({ items: [adminIncident], total: 1, page: 1, limit: 10 }));
    }
    return route.fallback();
  });
  await page.route("**/api/admin/incidents/incident-1/status", (route) =>
    fulfillJson(route, apiResponse({ ...adminIncident, status: route.request().postDataJSON().status }))
  );
  await page.route("**/api/admin/incidents/incident-1/priority", (route) =>
    fulfillJson(route, apiResponse({ ...adminIncident, priority: route.request().postDataJSON().priority }))
  );
  await page.route("**/api/admin/items**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return fulfillJson(
        route,
        apiResponse({
          items: [
            {
              ...rentableItem,
              owner_first_name: "Marta",
              owner_last_name: "Lopez",
              owner_avatar_url: "",
              owner_verification_status: "verified",
              primary_image_url: "",
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
          category_counts: { sports: 1 },
          city_counts: { Madrid: 1 },
          condition_counts: { good: 1 },
        })
      );
    }
    if (request.method() === "DELETE") return fulfillJson(route, apiResponse({ message: "deleted" }));
    return route.fallback();
  });
  await page.route("**/api/admin/verification**", (route) =>
    fulfillJson(route, apiResponse({ requests: [], total: 0, page: 1, limit: 1 }))
  );
  await page.route("**/api/admin/config", async (route) => {
    const request = route.request();
    const allow = request.method() === "PATCH" ? request.postDataJSON().allow_new_registrations : true;
    return fulfillJson(
      route,
      apiResponse({
        allow_new_registrations: allow,
        service_fee_eur: 5,
        insurance_daily_rate_eur: 2.3,
        booking_expiry_days: 5,
        updated_at: "2026-06-05T10:00:00Z",
        updated_by_email: "ada.admin@merenta.test",
      })
    );
  });
  await page.route("**/api/admin/audit**", (route) =>
    fulfillJson(route, apiResponse({ entries: [], total: 0, page: 1, limit: 20 }))
  );
}

test.describe("chat, checkout and admin flows", () => {
  test("lists conversations, marks read and sends a message", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockChatApi(page);
    let readCalled = false;
    await page.route("**/api/conversations/conv-1/read", (route) => {
      readCalled = true;
      return fulfillJson(route, apiResponse({}));
    });

    await page.goto("/chat/conv-1");
    await expect(page.getByText("Marta Lopez").first()).toBeVisible();
    await expect(page.getByText("Hola, esta disponible?").first()).toBeVisible();

    await page.getByRole("textbox", { name: "Mensaje" }).fill("Si, me interesa reservarla.");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    await expect(page.locator("section").getByText("Si, me interesa reservarla.")).toBeVisible();
    expect(readCalled).toBeTruthy();
  });

  test("shows a deleted conversation error", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockChatApi(page, { messagesFail: true });

    await page.goto("/chat/conv-1");

    await expect(page.getByText("conversacion eliminada")).toBeVisible();
  });

  test("books product dates and initializes checkout", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockCheckoutApi(page);
    const paymentIntentRequestPromise = page.waitForRequest(
      (request) => request.url().includes("/api/payment/intent") && request.method() === "POST"
    );

    await page.goto("/product/item-bike-1");
    await page.getByLabel("Seleccionar fecha de recogida").click();
    await page.getByRole("button", { name: /10 de Junio/i }).first().click();
    await page.getByRole("button", { name: /12 de Junio/i }).first().click();
    await expect(page.getByText(/Total.*con seguro/i)).toBeVisible();
    await page.getByRole("button", { name: "Solicitar alquiler" }).click();

    await expect(page).toHaveURL(/\/checkout\/item-bike-1\?start=2026-06-10&end=2026-06-12/);
    await expect(page.getByText("Bicicleta urbana").first()).toBeVisible();
    expect((await paymentIntentRequestPromise).postDataJSON()).toMatchObject({
      item_id: "item-bike-1",
      start_date: "2026-06-10",
      end_date: "2026-06-12",
      price_per_day: 18,
    });
  });

  test("admin triages an incident, updates settings and deletes a product", async ({ page }) => {
    await mockAuthenticatedSession(page, { role: "admin" });
    await mockAdminApi(page);
    const mutations: Array<{ url: string; method: string; body?: unknown }> = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/admin/")) {
        mutations.push({
          url: request.url(),
          method: request.method(),
          body: request.method() === "GET" ? undefined : request.postDataJSON(),
        });
      }
    });
    await page.route("**/api/admin/incidents/incident-1/**", async (route) => {
      mutations.push({ url: route.request().url(), method: route.request().method(), body: route.request().postDataJSON() });
      if (route.request().url().endsWith("/status")) {
        return fulfillJson(route, apiResponse({ ...adminIncident, status: route.request().postDataJSON().status }));
      }
      return fulfillJson(route, apiResponse({ ...adminIncident, priority: route.request().postDataJSON().priority }));
    });
    await page.route("**/api/admin/config", async (route) => {
      mutations.push({ url: route.request().url(), method: route.request().method(), body: route.request().postDataJSON() });
      const allow = route.request().method() === "PATCH" ? route.request().postDataJSON().allow_new_registrations : true;
      return fulfillJson(
        route,
        apiResponse({
          allow_new_registrations: allow,
          service_fee_eur: 5,
          insurance_daily_rate_eur: 2.3,
          booking_expiry_days: 5,
        })
      );
    });
    await page.route("**/api/admin/items/item-bike-1", async (route) => {
      mutations.push({ url: route.request().url(), method: route.request().method() });
      return fulfillJson(route, apiResponse({ message: "deleted" }));
    });

    await page.goto("/admin");
    await page.getByRole("button", { name: /Incidencias/i }).click();
    await expect(page.getByText("Bicicleta urbana").first()).toBeVisible();
    await page.getByRole("button", { name: /Prioridad/i }).click();
    await page.getByRole("button", { name: /Alta/i }).click();
    await page.getByRole("button", { name: /Estado/i }).click();
    await page.getByRole("button", { name: /En revision|En revisi/i }).click();

    await page.getByRole("button", { name: /Auditor/i }).click();
    await page.getByRole("button", { name: /Configuraci/i }).click();
    await page.getByRole("switch", { name: "Nuevos registros" }).click();

    await page.getByRole("button", { name: /Productos/i }).click();
    await page.getByRole("button", { name: /Eliminar Bicicleta urbana/i }).click();
    const deleteProductRequestPromise = page.waitForRequest(
      (request) => request.url().includes("/api/admin/items/item-bike-1") && request.method() === "DELETE"
    );
    await page.getByRole("button", { name: /^Eliminar$/ }).click();
    await deleteProductRequestPromise;

    expect(mutations.some((mutation) => mutation.url.includes("/priority") && mutation.method === "PATCH")).toBeTruthy();
    expect(mutations.some((mutation) => mutation.url.includes("/status") && mutation.method === "PATCH")).toBeTruthy();
    expect(mutations.some((mutation) => mutation.url.endsWith("/api/admin/config") && mutation.method === "PATCH")).toBeTruthy();
    expect(mutations.some((mutation) => mutation.url.endsWith("/api/admin/items/item-bike-1") && mutation.method === "DELETE")).toBeTruthy();
  });
});
