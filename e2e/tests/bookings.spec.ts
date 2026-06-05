import { expect, test, type Page } from "@playwright/test";

import { apiResponse, fulfillJson, mockAuthenticatedSession } from "./fixtures";

const renterPendingBooking = {
  booking_id: "booking-renter-pending",
  item_id: "item-bike-1",
  item_title: "Bicicleta urbana",
  item_image_url: "",
  renter_id: "customer-1",
  renter_first_name: "Lucia",
  renter_last_name: "Garcia",
  renter_verification_status: "verified",
  owner_id: "owner-1",
  start_date: "2026-06-12",
  end_date: "2026-06-14",
  requested_at: "2026-06-05T09:00:00Z",
  booking_status: "pending",
  estimated_total: 41,
  notes: "La recogeria por la tarde.",
  payment_intent_id: "pi_pending",
  expires_at: "2026-06-06T09:00:00Z",
};

const renterAcceptedPastBooking = {
  ...renterPendingBooking,
  booking_id: "booking-renter-accepted",
  item_id: "item-camera-1",
  item_title: "Camara mirrorless",
  start_date: "2025-05-30",
  end_date: "2025-06-01",
  booking_status: "accepted",
  estimated_total: 101,
  payment_intent_id: "pi_accepted",
};

const ownerPendingBooking = {
  ...renterPendingBooking,
  booking_id: "booking-owner-pending",
  item_id: "item-drill-1",
  item_title: "Taladro percutor",
  renter_id: "renter-2",
  renter_first_name: "Nora",
  renter_last_name: "Vidal",
  booking_status: "pending",
};

const ownerSecondPendingBooking = {
  ...ownerPendingBooking,
  booking_id: "booking-owner-second",
  item_id: "item-projector-1",
  item_title: "Proyector HD",
  renter_id: "renter-3",
  renter_first_name: "Mateo",
  renter_last_name: "Ruiz",
};

async function mockBookingsApi(page: Page) {
  await page.route("**/api/bookings/mine", (route) =>
    fulfillJson(
      route,
      apiResponse({
        items: [renterPendingBooking, renterAcceptedPastBooking],
        total: 2,
      })
    )
  );
  await page.route("**/api/bookings/as-owner", (route) =>
    fulfillJson(
      route,
      apiResponse({
        items: [ownerPendingBooking, ownerSecondPendingBooking],
        total: 2,
      })
    )
  );
  await page.route("**/api/bookings/*/*", (route) => fulfillJson(route, apiResponse({})));
  await page.route("**/api/conversations", (route) =>
    fulfillJson(route, apiResponse({ conversation_id: "conv-booking-1" }))
  );
  await page.route("**/api/incidents", (route) => fulfillJson(route, apiResponse({ incident_id: "incident-booking-1" })));
}

test.describe("bookings", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockBookingsApi(page);
  });

  test("updates renter and owner booking states and opens a booking conversation", async ({ page }) => {
    const mutations: Array<{ url: string; method: string }> = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/bookings/") && request.method() === "PATCH") {
        mutations.push({ url: request.url(), method: request.method() });
      }
    });

    await page.goto("/bookings");

    const renterPendingCard = page.locator("article", { hasText: "Bicicleta urbana" });
    await renterPendingCard.getByRole("button", { name: "Cancelar solicitud" }).click();
    await expect(renterPendingCard.getByText("Cancelada")).toBeVisible();

    const completedCard = page.locator("article", { hasText: "Camara mirrorless" });
    await completedCard.getByRole("button", { name: "Completar alquiler" }).click();
    await expect(completedCard.getByText("Completada")).toBeVisible();

    await page.getByRole("button", { name: /Solicitudes recibidas/i }).click();
    const acceptedCard = page.locator("article", { hasText: "Taladro percutor" });
    await acceptedCard.getByRole("button", { name: "Aceptar" }).click();
    await expect(acceptedCard.getByText("Aceptada")).toBeVisible();

    const rejectedCard = page.locator("article", { hasText: "Proyector HD" });
    await rejectedCard.getByRole("button", { name: "Rechazar" }).click();
    await expect(rejectedCard.getByText("Rechazada")).toBeVisible();

    await acceptedCard.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page).toHaveURL(/\/chat\/conv-booking-1$/);

    expect(mutations.map((mutation) => mutation.url.split("/").slice(-2).join("/"))).toEqual([
      "booking-renter-pending/cancel",
      "booking-renter-accepted/complete",
      "booking-owner-pending/accept",
      "booking-owner-second/reject",
    ]);
  });

  test("validates and submits an incident report from a booking", async ({ page }) => {
    const incidentRequestPromise = page.waitForRequest(
      (request) => request.url().endsWith("/api/incidents") && request.method() === "POST"
    );

    await page.goto("/bookings");
    const renterPendingCard = page.locator("article", { hasText: "Bicicleta urbana" });
    await renterPendingCard.getByRole("button", { name: /Reportar/i }).click();
    await expect(page.getByRole("heading", { name: "Reportar incidencia" })).toBeVisible();

    await page.getByRole("button", { name: "Enviar incidencia" }).click();
    await expect(page.getByText(/debe tener al menos 10 caracteres/i)).toBeVisible();

    await page.getByLabel(/Descripcion|Descripci/i).fill("El producto no estaba listo para la recogida.");
    await page.getByRole("button", { name: "Enviar incidencia" }).click();

    expect((await incidentRequestPromise).postDataJSON()).toEqual({
      booking_id: "booking-renter-pending",
      type: "damage",
      description: "El producto no estaba listo para la recogida.",
    });
    await expect(page.getByText(/Incidencia enviada correctamente/i)).toBeVisible();
  });
});
