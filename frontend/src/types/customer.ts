/**
 * Allowed account lifecycle states.
 */
type AccountStatus = "active" | "suspended" | "banned";
type VerificationStatus = "none" | "pending" | "verified" | "rejected";
/**
 * Roles supported by the platform.
 */
type UserRole = "customer" | "admin";

/**
 * Public-facing customer data safe to expose to clients.
 */
interface CustomerPublic {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  registration_date: string;
  account_status: AccountStatus;
  user_role: UserRole;
  /** ISO-8601 date when suspension ends; only present for suspended accounts. */
  suspended_until?: string | null;
  verification_status: VerificationStatus;
}

/**
 * Lightweight profile data used in listings and chats.
 */
interface CustomerProfile {
  customer_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  registration_date: string;
  verification_status: VerificationStatus;
}

/**
 * Login payload for authenticating a customer.
 */
interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Registration payload used to create a new account.
 */
interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone?: string;
}

export type {
  AccountStatus,
  CustomerProfile,
  CustomerPublic,
  LoginRequest,
  RegisterRequest,
  UserRole,
  VerificationStatus,
};
