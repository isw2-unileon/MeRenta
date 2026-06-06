import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFavorites } from "@/hooks/useFavorites";

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

function HookProbe({ onReady }: { onReady: (api: ReturnType<typeof useFavorites>) => void }) {
  onReady(useFavorites());
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useFavorites", () => {
  it("loads favorite ids on mount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ success: true, data: { items: [{ item_id: "item-1" }, { item_id: "item-2" }] } }),
      })
    );
    let api: ReturnType<typeof useFavorites> | undefined;

    render(<HookProbe onReady={(value) => (api = value)} />);
    await flush();

    expect(api?.isFav("item-1")).toBe(true);
    expect(api?.isFav("missing")).toBe(false);
  });

  it("optimistically toggles favorites and sends the right method", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    let api: ReturnType<typeof useFavorites> | undefined;

    render(<HookProbe onReady={(value) => (api = value)} />);
    await flush();
    act(() => {
      api?.toggle("item-1", false);
    });

    expect(api?.isFav("item-1")).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/favorites/item-1", { method: "POST", credentials: "include" });
  });

  it("reverts optimistic updates when the API call fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: { items: [{ item_id: "item-1" }] } }),
      })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    let api: ReturnType<typeof useFavorites> | undefined;

    render(<HookProbe onReady={(value) => (api = value)} />);
    await flush();
    act(() => {
      api?.toggle("item-1", true);
    });
    expect(api?.isFav("item-1")).toBe(false);
    await flush();

    expect(api?.isFav("item-1")).toBe(true);
  });

  it("does nothing when toggling is disabled", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }) });
    vi.stubGlobal("fetch", fetchMock);
    let api: ReturnType<typeof useFavorites> | undefined;

    render(<HookProbe onReady={(value) => (api = value)} />);
    await flush();
    act(() => {
      api?.toggle("item-1", false, { disabled: true });
    });

    expect(api?.isFav("item-1")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
