export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  status_code: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sort_by?: string;
  order?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  location?: string;
  condition?: ProductCondition;
  sort_by?: "price" | "date" | "relevance";
  order?: "asc" | "desc";
}

export type ProductCondition = "new" | "like_new" | "good" | "fair" | "poor";

export type ProductStatus = "available" | "reserved" | "sold";

export interface WSMessage {
  type: "chat" | "notification" | "typing" | "read";
  payload: unknown;
  timestamp: string;
}

export interface PaymentIntentRequest {
  product_id: string;
  amount: number;
}

export interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
}

export interface ImageUpload {
  file: File;
  bucket: string;
  path: string;
}

export interface ImageData {
  id: string;
  url: string;
  position: number;
}
