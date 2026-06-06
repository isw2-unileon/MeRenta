import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMe } from "@/hooks/useMe";
import type { BlockedAccountError } from "@/types/auth";
import type { CustomerPublic } from "@/types/customer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function render(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(ui);
  });
}

function HookProbe({ onReady }: { onReady: (api: ReturnType<typeof useMe>) => void }) {
  onReady(useMe());
  return null;
}

function mockFetch(response: unknown, ok = true, status = ok ? 200 : 500) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(response),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useMe", () => {
  it("fetches the current user with credentials", async () => {
    const customer: CustomerPublic = {
      customer_id: "c1",
      first_name: "Diego",
      last_name: "Perez",
      email: "diego@example.com",
      phone: null,
      avatar_url: null,
      registration_date: "2026-06-01T00:00:00Z",
      account_status: "active",
      user_role: "customer",
      verification_status: "none",
    };
    const fetchMock = mockFetch({ success: true, data: customer });
    let api: ReturnType<typeof useMe> | undefined;

    render(<HookProbe onReady={(value) => (api = value)} />);

    await expect(api?.getMe()).resolves.toBe(customer);
    expect(fetchMock).toHaveBeenCalledWith("/api/me", { method: "GET", credentials: "include" });
  });

  it("throws readable API errors", async () => {
    mockFetch({ success: false, error: "sesion caducada" }, false, 401);
    let api: ReturnType<typeof useMe> | undefined;

    render(<HookProbe onReady={(value) => (api = value)} />);

    await expect(api?.getMe()).rejects.toThrow("sesion caducada");
  });

  it("throws blocked account errors for banned and suspended accounts", async () => {
    let api: ReturnType<typeof useMe> | undefined;
    render(<HookProbe onReady={(value) => (api = value)} />);

    mockFetch({ success: false, error: "account_banned" }, false, 403);
    await expect(api?.getMe()).rejects.toMatchObject({ reason: "banned" } satisfies Partial<BlockedAccountError>);

    mockFetch(
      { success: false, error: "account_suspended", data: { suspended_until: "2026-07-01T00:00:00Z" } },
      false,
      403
    );
    await expect(api?.getMe()).rejects.toMatchObject({
      reason: "suspended",
      suspendedUntil: "2026-07-01T00:00:00Z",
    } satisfies Partial<BlockedAccountError>);
  });

  it("rejects malformed successful payloads", async () => {
    mockFetch({ success: true });
    let api: ReturnType<typeof useMe> | undefined;

    render(<HookProbe onReady={(value) => (api = value)} />);

    await expect(api?.getMe()).rejects.toThrow("Invalid response data");
  });
});
