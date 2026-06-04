import { useCallback } from "react";
import type { CustomerPublic } from "@/types/customer";
import type { ApiResponse } from "@/types/common";
import { BlockedAccountError } from "@/types/auth";

const API_BASE_URL = "/api";

/**
 * Extracts a human-readable error message from a failed API response.
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
 * Parses the authenticated user payload returned by the API.
 * @param response Successful response containing user data.
 * @returns The authenticated customer payload.
 * @throws Error when the payload is missing or malformed.
 */
const parseMeResponse = async (response: Response): Promise<CustomerPublic> => {
  const payload: unknown = await response.json();

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid response payload");
  }

  const data = (payload as ApiResponse<CustomerPublic>).data;
  if (!data) {
    throw new Error("Invalid response data");
  }

  return data;
};

/**
 * Builds an API helper for fetching the current authenticated user.
 * Authentication relies solely on the HttpOnly cookie set by the backend.
 * @returns Helper function for auth-aware API calls.
 */
function useMe() {
  /**
   * Fetches the current authenticated customer using the HttpOnly session cookie.
   * @returns The current customer payload.
   * @throws Error when the request fails.
   */
  const getMe = useCallback(async (): Promise<CustomerPublic> => {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 403) {
        const payload = (await response.json()) as ApiResponse<{ suspended_until?: string }>;
        if (payload.error === "account_banned") throw new BlockedAccountError("banned");
        if (payload.error === "account_suspended") {
          throw new BlockedAccountError("suspended", payload.data?.suspended_until ?? undefined);
        }
      }
      throw new Error(await parseErrorMessage(response));
    }

    return parseMeResponse(response);
  }, []);

  return { getMe };
}

export { useMe };
