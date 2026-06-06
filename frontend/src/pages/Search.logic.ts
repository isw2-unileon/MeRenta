// Pure constants, state model and helpers for the search page, kept UI-free for
// easy unit testing.
import type { SearchItemResponse, SearchItemsResponse } from "@/types/item";
import type { ReviewSummary } from "@/types/review";

/** Number of results requested per page. */
const PAGE_SIZE = 12;

/** Spanish display labels for each item category. */
const CATEGORY_LABELS: Record<string, string> = {
  electronics: "Electrónica",
  tools: "Herramientas",
  sports: "Deportes",
  vehicles: "Vehículos",
  home: "Hogar",
  gardening: "Jardinería",
  music: "Música",
  photography: "Fotografía",
  camping: "Camping",
  clothing: "Ropa",
  leisure: "Ocio",
  other: "Otros",
};

const CATEGORY_ORDER = [
  "electronics",
  "tools",
  "sports",
  "vehicles",
  "home",
  "gardening",
  "music",
  "photography",
  "camping",
  "clothing",
  "leisure",
  "other",
];

const CONDITION_LABELS: Record<string, string> = {
  new: "Nuevo",
  like_new: "Excelente",
  good: "Muy bueno",
  fair: "Bueno",
  poor: "Aceptable",
};

const CONDITION_ORDER = ["new", "like_new", "good", "fair", "poor"];

const SORT_OPTIONS = [
  { value: "recent", label: "Más recientes" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "oldest", label: "Más antiguos" },
];

const SEARCH_SKELETON_IDS = [
  "search-skel-1",
  "search-skel-2",
  "search-skel-3",
  "search-skel-4",
  "search-skel-5",
  "search-skel-6",
  "search-skel-7",
  "search-skel-8",
  "search-skel-9",
  "search-skel-10",
  "search-skel-11",
  "search-skel-12",
];

/** Reducer state for the search results page. */
interface SearchState {
  items: SearchItemResponse[];
  total: number;
  categoryCounts: Record<string, number>;
  cityCounts: Record<string, number>;
  conditionCounts: Record<string, number>;
  loading: boolean;
  error: string;
}

type SearchAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: SearchItemsResponse }
  | { type: "FETCH_ERROR"; error: string };

/** Initial search state (loading, no results yet). */
const initialSearchState: SearchState = {
  items: [],
  total: 0,
  categoryCounts: {},
  cityCounts: {},
  conditionCounts: {},
  loading: true,
  error: "",
};

const emptyReviewSummary: ReviewSummary = {
  average_rating: 0,
  total: 0,
  distribution: {},
};

/** Reduces search fetch lifecycle actions into the next state. */
function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: "" };
    case "FETCH_SUCCESS":
      return {
        ...state,
        items: action.payload.items,
        total: action.payload.total,
        categoryCounts: action.payload.category_counts,
        cityCounts: action.payload.city_counts,
        conditionCounts: action.payload.condition_counts,
        loading: false,
        error: "",
      };
    case "FETCH_ERROR":
      return {
        ...state,
        items: [],
        total: 0,
        categoryCounts: {},
        cityCounts: {},
        conditionCounts: {},
        loading: false,
        error: action.error,
      };
    default:
      return state;
  }
}

/** Returns the display label for a category, or a humanized fallback. */
function humanizeCategory(value: string): string {
  return CATEGORY_LABELS[value] ?? value.replaceAll("_", " ");
}

/** Returns the display label for a condition, or a humanized fallback. */
function humanizeCondition(value: string): string {
  return CONDITION_LABELS[value] ?? value.replaceAll("_", " ");
}

/**
 * Computes the page numbers to show in the pager: first, current, the next two,
 * and last, de-duplicated and sorted.
 */
function getPageWindow(page: number, totalPages: number): number[] {
  const pages = new Set<number>([1, page, page + 1, page + 2, totalPages].filter((p) => p >= 1 && p <= totalPages));
  return Array.from(pages).sort((a, b) => a - b);
}

export {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CONDITION_LABELS,
  CONDITION_ORDER,
  PAGE_SIZE,
  SEARCH_SKELETON_IDS,
  SORT_OPTIONS,
  emptyReviewSummary,
  getPageWindow,
  humanizeCategory,
  humanizeCondition,
  initialSearchState,
  searchReducer,
};
export type { SearchAction, SearchState };
