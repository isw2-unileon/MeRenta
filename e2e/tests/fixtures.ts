import type { Page, Route } from "@playwright/test";

type UserRole = "customer" | "admin";

interface MockUserOptions {
  role?: UserRole;
}

const jsonHeaders = {
  "content-type": "application/json",
};

const mockUser = ({ role = "customer" }: MockUserOptions = {}) => ({
  customer_id: role === "admin" ? "admin-1" : "customer-1",
  first_name: role === "admin" ? "Ada" : "Lucia",
  last_name: role === "admin" ? "Admin" : "Garcia",
  email: role === "admin" ? "ada.admin@merenta.test" : "lucia@merenta.test",
  phone: null,
  avatar_url: null,
  registration_date: "2026-01-10T10:00:00Z",
  account_status: "active",
  user_role: role,
  verification_status: "verified",
});

const bikeItem = {
  item_id: "item-bike-1",
  owner_id: "owner-1",
  address_id: "address-1",
  category: "sports",
  title: "Bicicleta urbana",
  item_status: "available",
  price_per_day: 18,
  is_available: true,
  published_at: "2026-05-01T08:00:00Z",
  city: "Madrid",
  postal_code: "28013",
  primary_image_url: "",
  owner_first_name: "Marta",
  owner_last_name: "Lopez",
  owner_avatar_url: "",
  owner_verification_status: "verified",
};

const cameraItem = {
  item_id: "item-camera-1",
  owner_id: "owner-2",
  address_id: "address-2",
  category: "photography",
  title: "Camara mirrorless",
  item_status: "available",
  price_per_day: 32,
  is_available: true,
  published_at: "2026-05-02T08:00:00Z",
  city: "Valencia",
  postal_code: "46001",
  primary_image_url: "",
  owner_first_name: "Nora",
  owner_last_name: "Vidal",
  owner_avatar_url: "",
  owner_verification_status: "none",
};

const searchPayload = {
  items: [bikeItem, cameraItem],
  total: 2,
  page: 1,
  limit: 12,
  category_counts: {
    sports: 1,
    photography: 1,
  },
  city_counts: {
    Madrid: 1,
    Valencia: 1,
  },
  condition_counts: {
    good: 2,
  },
};

const emptyFavoritesPayload = {
  items: [],
  total: 0,
};

const addressPayload = [
  {
    address_id: "address-user-1",
    customer_id: "customer-1",
    street: "Gran Via",
    number: "1",
    city: "Madrid",
    province: "Madrid",
    postal_code: "28013",
    country: "Espana",
  },
];

const bookingsPayload = {
  items: [],
  total: 0,
};

const reviewPayload = {
  average_rating: 4.8,
  total: 12,
  distribution: {
    "5": 10,
    "4": 2,
  },
};

const landingPayload = {
  stats: {
    available_products: 2,
    users: 3,
    average_rating: 4.8,
    total_reviews: 12,
  },
  categories: [
    { category: "sports", count: 1 },
    { category: "photography", count: 1 },
  ],
  featured: [bikeItem, cameraItem],
};

function apiResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

async function mockGuestSession(page: Page) {
  await page.route("**/api/me", (route) =>
    fulfillJson(
      route,
      {
        success: false,
        error: "unauthorized",
      },
      401
    )
  );
}

async function mockAuthenticatedSession(page: Page, options: MockUserOptions = {}) {
  const user = mockUser(options);

  await page.route("**/api/me", (route) => fulfillJson(route, apiResponse(user)));
  await page.route("**/api/auth/logout", (route) => fulfillJson(route, apiResponse({})));
  await mockMarketplaceApi(page);

  return user;
}

async function mockMarketplaceApi(page: Page) {
  await page.route("**/api/landing", (route) => fulfillJson(route, apiResponse(landingPayload)));
  await page.route("**/api/items?*", (route) => fulfillJson(route, apiResponse(searchPayload)));
  await page.route("**/api/favorites", (route) => fulfillJson(route, apiResponse(emptyFavoritesPayload)));
  await page.route("**/api/favorites/*", (route) => fulfillJson(route, apiResponse({})));
  await page.route("**/api/bookings/mine", (route) => fulfillJson(route, apiResponse(bookingsPayload)));
  await page.route("**/api/addresses", (route) => fulfillJson(route, apiResponse(addressPayload)));
  await page.route("**/api/reviews/summary/*", (route) => fulfillJson(route, apiResponse(reviewPayload)));
}

export {
  apiResponse,
  bikeItem,
  cameraItem,
  fulfillJson,
  landingPayload,
  mockAuthenticatedSession,
  mockGuestSession,
  mockMarketplaceApi,
  mockUser,
  searchPayload,
};
