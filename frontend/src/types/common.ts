/**
 * Generic API response wrapper used by backend endpoints.
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Standard API error payload with validation details.
 */
interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  status_code: number;
}

/**
 * Common pagination and sorting parameters for list endpoints.
 */
interface PaginationParams {
  page: number;
  limit: number;
  sort_by?: string;
  order?: "asc" | "desc";
}

/**
 * Response shape for paginated resources.
 */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

/**
 * Query filters for product search.
 */
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

/**
 * Normalized condition values for listings.
 */
type ProductCondition = "new" | "like_new" | "good" | "fair" | "poor";

/**
 * Availability states for a listing.
 */
type ProductStatus = "available" | "reserved" | "sold";

/**
 * WebSocket message envelope for realtime events.
 */
interface WSMessage {
  type: "chat" | "notification" | "typing" | "read";
  payload: unknown;
  timestamp: string;
}

/**
 * Payload to initialize a payment intent.
 */
interface PaymentIntentRequest {
  product_id: string;
  amount: number;
}

/**
 * Response data needed to complete a payment.
 */
interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
}

/**
 * Upload metadata for images stored externally.
 */
interface ImageUpload {
  file: File;
  bucket: string;
  path: string;
}

/**
 * Persisted image metadata returned by the API.
 */
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
