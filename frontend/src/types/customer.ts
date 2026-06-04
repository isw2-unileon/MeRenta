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
 * Full customer record including private fields.
 */
interface Customer {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  avatar_url: string | null;
  registration_date: string;
  account_status: AccountStatus;
  user_role: UserRole;
  verification_status: VerificationStatus;
  stripe_customer_id: string | null;
}

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

/**
 * Partial profile update payload.
 */
interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

/**
 * Login response containing token and customer info.
 */
interface LoginResponse {
  token: string;
  customer: CustomerPublic;
}

/**
 * Registration response containing token and customer info.
 */
interface RegisterResponse {
  token: string;
  customer: CustomerPublic;
}

export type {
  AccountStatus,
  Customer,
  CustomerProfile,
  CustomerPublic,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  UpdateProfileRequest,
  UserRole,
  VerificationStatus,
};
