import type { CustomerProfile } from "@/types/customer";
import type { ItemImageResponse, ItemResponse } from "@/types/item";
import type { ReviewSummary } from "@/types/review";

const CATEGORY_LABELS: Record<string, string> = {
  sports: "Deportes",
  electronics: "ElectrÃ³nica",
  tools: "Herramientas",
  music: "MÃºsica",
  photography: "FotografÃ­a",
  camping: "Camping",
  home: "Hogar",
  clothing: "Ropa",
  vehicles: "VehÃ­culos",
  gardening: "JardinerÃ­a",
  leisure: "Ocio",
  other: "Otros",
};

const CONDITION_LABELS: Record<string, string> = {
  new: "Nuevo",
  like_new: "Excelente",
  good: "Muy bueno",
  fair: "Bueno",
  poor: "Aceptable",
};

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface ProductState {
  item: ItemResponse | null;
  images: ItemImageResponse[];
  owner: CustomerProfile | null;
  ownerReviewSummary: ReviewSummary | null;
  loading: boolean;
  error: string;
  dateRange: DateRange;
}

type ProductAction =
  | { type: "set-loading"; value: boolean }
  | { type: "set-error"; value: string }
  | { type: "set-item"; value: ItemResponse | null }
  | { type: "set-images"; value: ItemImageResponse[] }
  | { type: "set-owner"; value: CustomerProfile | null }
  | { type: "set-owner-review-summary"; value: ReviewSummary | null }
  | { type: "set-date-range"; value: DateRange };

const INITIAL_STATE: ProductState = {
  item: null,
  images: [],
  owner: null,
  ownerReviewSummary: null,
  loading: true,
  error: "",
  dateRange: { start: null, end: null },
};

const emptyReviewSummary: ReviewSummary = {
  average_rating: 0,
  total: 0,
  distribution: {},
};

const PRODUCT_SKELETON_THUMB_IDS = [
  "product-skel-thumb-1",
  "product-skel-thumb-2",
  "product-skel-thumb-3",
  "product-skel-thumb-4",
  "product-skel-thumb-5",
];

function productReducer(state: ProductState, action: ProductAction): ProductState {
  switch (action.type) {
    case "set-loading":
      return { ...state, loading: action.value };
    case "set-error":
      return { ...state, error: action.value };
    case "set-item":
      return { ...state, item: action.value };
    case "set-images":
      return { ...state, images: action.value };
    case "set-owner":
      return { ...state, owner: action.value };
    case "set-owner-review-summary":
      return { ...state, ownerReviewSummary: action.value };
    case "set-date-range":
      return { ...state, dateRange: action.value };
    default:
      return state;
  }
}

function formatRating(rating: number): string {
  return rating.toFixed(2);
}

function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function expandUnavailableRanges(ranges: Array<{ start_date: string; end_date: string }>): Set<string> {
  const dates = new Set<string>();
  for (const range of ranges) {
    const cur = new Date(`${range.start_date}T00:00:00`);
    const endD = new Date(`${range.end_date}T00:00:00`);
    while (cur <= endD) {
      dates.add(toLocalISODate(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return dates;
}

export {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  INITIAL_STATE,
  PRODUCT_SKELETON_THUMB_IDS,
  emptyReviewSummary,
  productReducer,
  formatRating,
  expandUnavailableRanges,
};
export type { DateRange, ProductAction, ProductState };
