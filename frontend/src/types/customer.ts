type AccountStatus = "active" | "inactive" | "suspended" | "banned";
export type UserRole = "customer" | "admin";

export interface Customer {
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

export interface CustomerPublic {
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

export interface CustomerProfile {
  customer_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  registration_date: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone?: string;
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

export interface LoginResponse {
  token: string;
  customer: CustomerPublic;
}

export interface RegisterResponse {
  token: string;
  customer: CustomerPublic;
}
