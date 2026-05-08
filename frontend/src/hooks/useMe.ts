import { useCallback } from "react";
import type { CustomerPublic } from "@/types/customer";

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

const parseMeResponse = async (response: Response): Promise<CustomerPublic> => {
  const payload: unknown = await response.json();

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid response payload");
  }

  const data = (payload as { data?: unknown }).data;

  if (!data || typeof data !== "object") {
    throw new Error("Invalid response data");
  }

  return data as CustomerPublic;
};

export function useMe(accessToken: string | null) {
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
