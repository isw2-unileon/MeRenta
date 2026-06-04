/**
 * Generic API response wrapper used by backend endpoints.
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export type { ApiResponse };
