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

export {
  fetchMyItems,
  fetchReceivedReviews,
  formatMemberSince,
  getInitials,
  initialProductsState,
  productsReducer,
  uniqueProductCities,
};

export type { ProductsAction, ProductsState, ReceivedReviewsResponseBase, ReviewsSummary };
