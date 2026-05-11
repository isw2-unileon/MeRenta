import { useCallback } from "react";
import type { CustomerPublic } from "@/types/customer";
import type { ApiResponse } from "@/types/common";

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
 * Builds API helpers for fetching the current user using an optional access token.
 * @param accessToken Optional bearer token for authenticated calls.
 * @returns Helper functions for auth-aware API calls.
 */
function useMe(accessToken: string | null) {
  /**
   * Fetches the current authenticated customer.
   * @returns The current customer payload.
   * @throws Error when the request fails.
   */
  const getMe = useCallback(async (): Promise<CustomerPublic> => {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: "GET",
      credentials: "include",
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    return parseMeResponse(response);
  }, [accessToken]);

  return { getMe };
}

export { useMe };
