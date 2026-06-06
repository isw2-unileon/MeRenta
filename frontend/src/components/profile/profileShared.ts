// Shared state, fetch helpers and formatters used by the profile pages
// (MyProfile and ProfileOther).
import type { ApiResponse } from "@/types/common";
import type { SearchItemResponse, SearchItemsResponse } from "@/types/item";

/** Reducer state for the profile's "my products" list. */
interface ProductsState {
  items: SearchItemResponse[];
  total: number;
  loading: boolean;
  error: string;
}

/** Reducer actions for loading the profile's product list. */
type ProductsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: SearchItemsResponse }
  | { type: "fetch_error"; error: string };

/** Initial (loading) state for the products reducer. */
const initialProductsState: ProductsState = {
  items: [],
  total: 0,
  loading: true,
  error: "",
};

/** Reduces product-list loading actions into the next state. */
function productsReducer(state: ProductsState, action: ProductsAction): ProductsState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: "" };
    case "fetch_success":
      return {
        items: action.payload.items,
        total: action.payload.total,
        loading: false,
        error: "",
      };
    case "fetch_error":
      return {
        items: [],
        total: 0,
        loading: false,
        error: action.error,
      };
    default:
      return state;
  }
}

/** Fetches the authenticated user's own listings, aborting on signal. */
async function fetchMyItems(signal: AbortSignal): Promise<SearchItemsResponse> {
  const res = await fetch("/api/items/mine?limit=48", {
    credentials: "include",
    signal,
  });
  const json = (await res.json()) as ApiResponse<SearchItemsResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar tus productos");
  }
  return json.data;
}

/** Aggregate rating summary returned alongside a list of received reviews. */
interface ReviewsSummary {
  average_rating: number;
  total: number;
  distribution: Record<string, number>;
}

/** Paginated received-reviews response, generic over the review item shape. */
interface ReceivedReviewsResponseBase<TItem> {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
  summary: ReviewsSummary;
}

/** Fetches the first page of reviews received by the current user. */
async function fetchReceivedReviews<TItem>(signal: AbortSignal): Promise<ReceivedReviewsResponseBase<TItem>> {
  const res = await fetch("/api/reviews/received?limit=4", {
    credentials: "include",
    signal,
  });
  const json = (await res.json()) as ApiResponse<ReceivedReviewsResponseBase<TItem>>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar tus valoraciones");
  }
  return json.data;
}

/** Returns the uppercase initials for a first/last name pair. */
function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

/** Formats a registration date as "month year" in Spanish, or "" when absent. */
function formatMemberSince(date?: string) {
  if (!date) return "";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  return `${months[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

/** Returns the distinct, non-empty cities across a list of products. */
function uniqueProductCities(products: SearchItemResponse[]) {
  return Array.from(new Set(products.flatMap((product) => (product.city ? [product.city] : []))));
}

/** A single review received by a customer, as shown on the profile pages. */
interface ReceivedReview {
  review_id: string;
  reviewer_id: string;
  reviewer_first_name: string;
  reviewer_last_name: string;
  reviewer_avatar_url?: string;
  rating: number;
  comment: string;
  reviewed_at: string;
}

/** Returns the reviewer's uppercase initials. */
function reviewerInitials(review: ReceivedReview) {
  return getInitials(review.reviewer_first_name, review.reviewer_last_name);
}

/** Returns the reviewer's display name as "First L." (last name abbreviated). */
function reviewerDisplayName(review: ReceivedReview) {
  const lastInitial = review.reviewer_last_name[0] ? `${review.reviewer_last_name[0]}.` : "";
  return `${review.reviewer_first_name} ${lastInitial}`.trim();
}

/** Formats a date as a Spanish relative label (e.g. "Hoy", "Hace 3 días"). */
function formatRelativeDate(value: string) {
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return "";

  const diffDays = Math.floor((Date.now() - created.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Hoy";
  if (diffDays === 1) return "Hace 1 dia";
  if (diffDays < 7) return `Hace ${diffDays} días`;

  const weeks = Math.floor(diffDays / 7);
  if (weeks === 1) return "Hace 1 semana";
  if (weeks < 5) return `Hace ${weeks} semanas`;

  const months = Math.floor(diffDays / 30);
  if (months <= 1) return "Hace 1 mes";
  return `Hace ${months} meses`;
}

export {
  fetchMyItems,
  fetchReceivedReviews,
  formatMemberSince,
  formatRelativeDate,
  getInitials,
  initialProductsState,
  productsReducer,
  reviewerDisplayName,
  reviewerInitials,
  uniqueProductCities,
};

export type { ProductsAction, ProductsState, ReceivedReview, ReceivedReviewsResponseBase, ReviewsSummary };
