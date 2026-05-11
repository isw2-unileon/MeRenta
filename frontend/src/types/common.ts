interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  status_code: number;
}

interface PaginationParams {
  page: number;
  limit: number;
  sort_by?: string;
  order?: "asc" | "desc";
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface SearchFilters {
  query?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  location?: string;
  condition?: ProductCondition;
  sort_by?: "price" | "date" | "relevance";
  order?: "asc" | "desc";
}

type ProductCondition = "new" | "like_new" | "good" | "fair" | "poor";

type ProductStatus = "available" | "reserved" | "sold";

interface WSMessage {
  type: "chat" | "notification" | "typing" | "read";
  payload: unknown;
  timestamp: string;
}

interface PaymentIntentRequest {
  product_id: string;
  amount: number;
}

interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
}

interface ImageUpload {
  file: File;
  bucket: string;
  path: string;
}

interface ImageData {
  id: string;
  url: string;
  position: number;
}

export type {
  ApiError,
  ApiResponse,
  ImageData,
  ImageUpload,
  PaginatedResponse,
  PaginationParams,
  PaymentIntentRequest,
  PaymentIntentResponse,
  ProductCondition,
  ProductStatus,
  SearchFilters,
  WSMessage,
};
