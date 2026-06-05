import type { VerificationStatus } from "@/types/customer";
import type { SearchItemResponse } from "@/types/item";
import type { ReceivedReview, ReceivedReviewsResponseBase, ReviewsSummary } from "@/components/profile/profileShared";

type ReceivedReviewsResponse = ReceivedReviewsResponseBase<ReceivedReview>;

interface ReviewsState {
  items: ReceivedReview[];
  total: number;
  summary: ReviewsSummary;
  loading: boolean;
  error: string;
}

type ReviewsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: ReceivedReviewsResponse }
  | { type: "fetch_error"; error: string };

const PRODUCT_TONES: Record<string, string> = {
  sports: "bg-cat-deporte",
  photography: "bg-cat-fotografia",
  camping: "bg-cat-aventura",
  music: "bg-cat-musica",
  tools: "bg-cat-herramientas",
  electronics: "bg-cat-electronica",
  home: "bg-cat-orange-alt",
  gardening: "bg-cat-deporte",
  vehicles: "bg-cat-blue-alt",
  clothing: "bg-cat-purple-alt",
  other: "bg-primary-light",
};

const emptyReviewsSummary: ReviewsSummary = {
  average_rating: 0,
  total: 0,
  distribution: {},
};

const initialReviewsState: ReviewsState = {
  items: [],
  total: 0,
  summary: emptyReviewsSummary,
  loading: true,
  error: "",
};

const PRODUCTS_SKELETON_IDS = [
  "profile-product-skel-1",
  "profile-product-skel-2",
  "profile-product-skel-3",
  "profile-product-skel-4",
  "profile-product-skel-5",
  "profile-product-skel-6",
];

const VERIFICATION_BUTTON_LABEL: Record<VerificationStatus, string> = {
  none: "Solicitar badge verificado",
  pending: "Solicitud pendiente",
  verified: "Perfil verificado",
  rejected: "Solicitar de nuevo",
};

function reviewsReducer(state: ReviewsState, action: ReviewsAction): ReviewsState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: "" };
    case "fetch_success":
      return {
        items: action.payload.items,
        total: action.payload.total,
        summary: action.payload.summary,
        loading: false,
        error: "",
      };
    case "fetch_error":
      return {
        items: [],
        total: 0,
        summary: emptyReviewsSummary,
        loading: false,
        error: action.error,
      };
    default:
      return state;
  }
}

function getStatusLabel(product: SearchItemResponse) {
  if (product.item_status === "rented") return "Reservado";
  if (product.item_status === "retired") return "Retirado";
  if (product.is_available) return "Disponible";
  return "No disponible";
}

function distributionPercent(count: number, total: number) {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

export {
  PRODUCT_TONES,
  PRODUCTS_SKELETON_IDS,
  VERIFICATION_BUTTON_LABEL,
  distributionPercent,
  emptyReviewsSummary,
  getStatusLabel,
  initialReviewsState,
  reviewsReducer,
};
export type { ReceivedReviewsResponse, ReviewsAction, ReviewsState };
