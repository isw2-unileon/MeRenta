/**
 * UI-level form state for the product creation form.
 * Not the same as the API payload — includes extra UI-only fields.
 */
interface ProductFormData {
  // Basic info
  title: string;
  category: string;
  subcategory: string;
  condition: string;
  description: string;
  // Photos
  photos: File[];
  // Price
  pricePerDay: string;
  pricePerWeek: string;
  deposit: string;
  minRentalPeriod: string;
  maxRentalPeriod: string;
  // Location
  address: string;
  city: string;
  deliveryRadius: string;
  availableNow: boolean;
  blockDates: boolean;
  // Conditions
  usageRules: string;
}

/**
 * Payload sent to POST /api/items.
 * Matches model.CreateItemRequest in the backend.
 */
interface CreateItemRequest {
  address_id: string;
  category: string;
  title: string;
  description?: string;
  brand?: string;
  model?: string;
  price_per_day: number;
  deposit?: number;
  min_days: number;
  max_days?: number;
}

/**
 * API response for a single item listing.
 * Matches model.ItemResponse in the backend.
 */
interface ItemResponse {
  item_id: string;
  owner_id: string;
  address_id: string;
  category: string;
  title: string;
  description?: string;
  brand?: string;
  model?: string;
  item_status: string;
  price_per_day: number;
  deposit?: number;
  min_days: number;
  max_days?: number | null;
  is_available: boolean;
  published_at: string;
}

/**
 * API response for a single item image stored in Supabase and item_image table.
 * Matches model.ItemImageResponse in the backend.
 */
interface ItemImageResponse {
  image_id: string;
  item_id: string;
  image_url: string;
  display_order: number;
}

/**
 * Category option used in the creation form dropdowns.
 */
interface CategoryOption {
  value: string;
  label: string;
  subcategories: string[];
}

export type { CategoryOption, CreateItemRequest, ItemImageResponse, ItemResponse, ProductFormData };
