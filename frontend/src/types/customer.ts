type AccountStatus = "active" | "inactive" | "suspended" | "banned";
type UserRole = "customer" | "admin";

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
  stripe_customer_id: string | null;
}

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
}

interface CustomerProfile {
  customer_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  registration_date: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone?: string;
}

interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

interface LoginResponse {
  token: string;
  customer: CustomerPublic;
}

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
};
