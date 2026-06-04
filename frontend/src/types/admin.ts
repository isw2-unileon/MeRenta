import type { AccountStatus, VerificationStatus } from "@/types/customer";

/**
 * Roles as returned by the API (backend uses "user", not "customer").
 */
type AdminUserRole = "user" | "admin";

/**
 * A customer row as returned by the admin user-listing endpoint.
 */
interface AdminUser {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url?: string;
  registration_date: string;
  account_status: AccountStatus;
  user_role: AdminUserRole;
}

/**
 * Paginated response from GET /api/admin/users.
 */
interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}
interface AdminVerificationRequest {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url?: string;
  account_status: AccountStatus;
  verification_status: Exclude<VerificationStatus, "none">;
  requested_at: string;
  has_address: boolean;
}

interface AdminVerificationListResponse {
  requests: AdminVerificationRequest[];
  total: number;
  page: number;
  limit: number;
}

export type {
  AdminUser,
  AdminUserListResponse,
  AdminUserRole,
  AdminVerificationListResponse,
  AdminVerificationRequest,
};
