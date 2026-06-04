import type { ApiResponse } from "@/types/common";
import type { SearchItemResponse, SearchItemsResponse } from "@/types/item";

interface ProductsState {
  items: SearchItemResponse[];
  total: number;
  loading: boolean;
  error: string;
}

type ProductsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: SearchItemsResponse }
  | { type: "fetch_error"; error: string };

const initialProductsState: ProductsState = {
  items: [],
  total: 0,
  loading: true,
  error: "",
};

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

interface ReviewsSummary {
  average_rating: number;
  total: number;
  distribution: Record<string, number>;
}

interface ReceivedReviewsResponseBase<TItem> {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
  summary: ReviewsSummary;
}

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

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

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

function uniqueProductCities(products: SearchItemResponse[]) {
  return Array.from(new Set(products.flatMap((product) => (product.city ? [product.city] : []))));
}

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

function reviewerInitials(review: ReceivedReview) {
  return getInitials(review.reviewer_first_name, review.reviewer_last_name);
}

function reviewerDisplayName(review: ReceivedReview) {
  const lastInitial = review.reviewer_last_name[0] ? `${review.reviewer_last_name[0]}.` : "";
  return `${review.reviewer_first_name} ${lastInitial}`.trim();
}

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
