// Shared fetch helpers that unwrap the standard `{ success, data, error }`
// API envelope used by every admin endpoint.
import type { ApiResponse } from "@/types/common";

/** GETs a JSON endpoint and returns `data`, throwing `errorMessage` on failure. */
async function getAdminData<T>(url: string, errorMessage: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? errorMessage);
  }
  return json.data;
}

/** Sends a JSON mutation (PATCH/POST/…) and asserts success, throwing on failure. */
async function sendAdminMutation(url: string, method: string, body: unknown, errorMessage: string): Promise<void> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? errorMessage);
  }
}

export { getAdminData, sendAdminMutation };
