import type { ApiResponse } from "@/types/common";
import type { LandingResponse } from "@/types/landing";

/**
 * Fetches the public landing-page payload (stats, categories, featured items).
 * The endpoint is unauthenticated, so no credentials are sent.
 */
async function fetchLanding(signal?: AbortSignal): Promise<LandingResponse> {
  const res = await fetch("/api/landing", { signal });
  const json = (await res.json()) as ApiResponse<LandingResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.message ?? json.error ?? "Error al cargar la página");
  }
  return json.data;
}

export { fetchLanding };
