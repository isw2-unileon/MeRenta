import { createContext, useCallback, useEffect, useReducer } from "react";
import * as React from "react";
import type { CustomerPublic, LoginRequest, RegisterRequest } from "@/types/customer";
import { BlockedAccountError } from "@/types/auth";
import { useMe } from "@/hooks/useMe";

/**
 * Describes the authentication context contract exposed to consumers.
 */
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: CustomerPublic | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  accessToken: string | null;
  /** Set when the account is blocked. Drives redirect in ProtectedRoute. */
  blockedReason: "banned" | "suspended" | null;
  suspendedUntil: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = "/api";
const AUTH_TOKEN_STORAGE_KEY = "merenta:access-token";
let initialSessionLoadStarted = false;

/**
 * Extracts a readable error message from an API response payload.
 * @param response Failed response to inspect for error messages.
 * @returns A user-facing message suitable for UI feedback.
 */
const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object") {
      const maybePayload = payload as { error?: string; message?: string };
      if (typeof maybePayload.error === "string" && maybePayload.error.trim() !== "") {
        return maybePayload.error;
      }
      if (typeof maybePayload.message === "string" && maybePayload.message.trim() !== "") {
        return maybePayload.message;
      }
    }
    return "Request failed";
  } catch {
    return "Request failed";
  }
};

/**
 * Parses the login/register response into a token and user object.
 * @param response Successful auth response to decode.
 * @returns Auth token and customer payload.
 * @throws Error when the payload is missing or malformed.
 */
const parseAuthResponse = async (
  response: Response
): Promise<{
  token: string;
  customer: CustomerPublic;
}> => {
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid response payload");
  }
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response data");
  }
  const token = (data as { token?: unknown }).token;
  const customer = (data as { customer?: unknown }).customer;
  if (typeof token !== "string" || !customer || typeof customer !== "object") {
    throw new Error("Invalid auth response");
  }
  return { token, customer: customer as CustomerPublic };
};

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: CustomerPublic | null;
  accessToken: string | null;
  blockedReason: "banned" | "suspended" | null;
  suspendedUntil: string | null;
}

type AuthAction =
  | { type: "load_start" }
  | { type: "load_success"; user: CustomerPublic }
  | { type: "load_failure" }
  | { type: "load_blocked"; reason: "banned" | "suspended"; suspendedUntil?: string }
  | { type: "login_success"; user: CustomerPublic; token: string }
  | { type: "login_failure" }
  | { type: "register_success"; user: CustomerPublic; token: string }
  | { type: "register_failure" }
  | { type: "logout_start" }
  | { type: "logout_success" }
  | { type: "logout_failure" };

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  accessToken: readStoredAccessToken(),
  blockedReason: null,
  suspendedUntil: null,
};

function readStoredAccessToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeAccessToken(token: string): void {
  try {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    // The auth cookie still keeps HTTP requests authenticated when storage is unavailable.
  }
}

function clearStoredAccessToken(): void {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage failures while clearing auth state.
  }
}

/**
 * Handles state transitions for authentication actions.
 * @param state Current auth state snapshot.
 * @param action State transition descriptor.
 * @returns The next auth state.
 */
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "load_start":
      return { ...state, isLoading: true };
    case "load_success":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.user,
      };
    case "load_failure":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        blockedReason: null,
        suspendedUntil: null,
      };
    case "load_blocked":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        blockedReason: action.reason,
        suspendedUntil: action.suspendedUntil ?? null,
      };
    case "login_success":
    case "register_success":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.user,
        accessToken: action.token,
      };
    case "login_failure":
    case "register_failure":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      };
    case "logout_start":
      return {
        ...state,
        isLoading: true,
      };
    case "logout_success":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      };
    case "logout_failure":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      };
    default:
      return state;
  }
};

/**
 * Provides authentication state and actions to descendant components.
 * @param children React subtree that needs auth state.
 * @returns Auth context provider wrapper.
 */
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { isAuthenticated, isLoading, user, accessToken, blockedReason, suspendedUntil } = state;

  const { getMe } = useMe(accessToken);

  useEffect(() => {
    if (initialSessionLoadStarted) {
      return;
    }
    initialSessionLoadStarted = true;

    if (!accessToken) {
      dispatch({ type: "load_failure" });
      return;
    }

    const loadSession = async () => {
      dispatch({ type: "load_start" });
      try {
        const customer = await getMe();
        dispatch({ type: "load_success", user: customer });
      } catch (err) {
        if (err instanceof BlockedAccountError) {
          dispatch({ type: "load_blocked", reason: err.reason, suspendedUntil: err.suspendedUntil });
          return;
        }
        clearStoredAccessToken();
        dispatch({ type: "load_failure" });
      }
    };

    void loadSession();
  }, [accessToken, getMe]);

  /**
   * Executes the login flow and stores the auth token locally.
   * @param credentials Email/password credentials.
   * @returns Resolves when the auth state is updated.
   * @throws Error when the API returns a non-OK response.
   */
  const login = useCallback(async (credentials: LoginRequest) => {
    dispatch({ type: "load_start" });
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        if (response.status === 403) {
          const payload = (await response.json()) as { error?: string; data?: { suspended_until?: string } };
          if (payload.error === "account_banned") throw new BlockedAccountError("banned");
          if (payload.error === "account_suspended") {
            throw new BlockedAccountError("suspended", payload.data?.suspended_until ?? undefined);
          }
        }
        throw new Error(await parseErrorMessage(response));
      }

      const { token, customer } = await parseAuthResponse(response);
      storeAccessToken(token);
      dispatch({ type: "login_success", user: customer, token });
    } catch (error) {
      clearStoredAccessToken();
      dispatch({ type: "login_failure" });
      throw error;
    }
  }, []);

  /**
   * Registers a new customer and updates auth state on success.
   * @param data Registration details provided by the user.
   * @returns Resolves when the auth state is updated.
   * @throws Error when the API returns a non-OK response.
   */
  const register = useCallback(async (data: RegisterRequest) => {
    dispatch({ type: "load_start" });
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          password: data.password,
          confirm_password: data.confirm_password,
          phone: data.phone ?? undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const { token, customer } = await parseAuthResponse(response);
      storeAccessToken(token);
      dispatch({ type: "register_success", user: customer, token });
    } catch (error) {
      clearStoredAccessToken();
      dispatch({ type: "register_failure" });
      throw error;
    }
  }, []);

  /**
   * Clears the local auth state.
   * @returns Nothing; state is reset synchronously.
   */
  const logout = useCallback(async () => {
    dispatch({ type: "logout_start" });

    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      clearStoredAccessToken();
      dispatch({ type: "logout_success" });
    } catch (error) {
      clearStoredAccessToken();
      dispatch({ type: "logout_failure" });
      throw error;
    }
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    login,
    register,
    logout,
    accessToken,
    blockedReason,
    suspendedUntil,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext, AuthProvider };
