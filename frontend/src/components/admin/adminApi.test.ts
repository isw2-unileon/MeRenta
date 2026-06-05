import { afterEach, describe, expect, it, vi } from "vitest";

import { getAdminData, sendAdminMutation } from "@/components/admin/adminApi";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockFetch(response: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(response),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("adminApi", () => {
  it("unwraps successful GET responses", async () => {
    const fetchMock = mockFetch({ success: true, data: { total: 2 } });

    await expect(getAdminData<{ total: number }>("/api/admin/users", "fallback")).resolves.toEqual({ total: 2 });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users", { credentials: "include" });
  });

  it("throws the API error when GET fails", async () => {
    mockFetch({ success: false, error: "sin permisos" }, false);

    await expect(getAdminData("/api/admin/users", "fallback")).rejects.toThrow("sin permisos");
  });

  it("sends JSON mutations with credentials", async () => {
    const fetchMock = mockFetch({ success: true });

    await expect(
      sendAdminMutation("/api/admin/users/1/status", "PATCH", { status: "active" }, "fallback")
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/1/status", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
  });

  it("throws the fallback message when a mutation response has no API error", async () => {
    mockFetch({ success: false }, false);

    await expect(sendAdminMutation("/api/admin/items/1", "DELETE", {}, "No se pudo borrar")).rejects.toThrow(
      "No se pudo borrar"
    );
  });
});
