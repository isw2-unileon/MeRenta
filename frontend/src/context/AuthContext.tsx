import { createContext, useState, useEffect, useCallback } from "react";
import * as React from "react";
import type { CustomerPublic, LoginRequest, RegisterRequest } from "@/types/customer";
import { useMe } from "@/hooks/useMe";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: CustomerPublic | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = "/api";

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

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<CustomerPublic | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const { getMe } = useMe(accessToken);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const customer = await getMe();

        setUser(customer);
        setIsAuthenticated(true);
        setAccessToken(null);
      } catch {
        setUser(null);
        setAccessToken(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSession();
  }, [getMe]);

  const login = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true);
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
        throw new Error(await parseErrorMessage(response));
      }

      const { token, customer } = await parseAuthResponse(response);

      setAccessToken(token);
      setUser(customer);
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      setAccessToken(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    setIsLoading(true);
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
      setAccessToken(token);
      setUser(customer);
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      setAccessToken(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    login,
    register,
    logout,
    accessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext, AuthProvider };
