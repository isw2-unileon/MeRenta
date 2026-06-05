import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/router/ProtectedRoute";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: false,
    isLoading: false,
    blockedReason: null as "banned" | "suspended" | null,
    suspendedUntil: null as string | null,
  },
}));

vi.mock("@/hooks/useAuth.ts", () => ({
  useAuth: () => authState.current,
}));

let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  authState.current = { isAuthenticated: false, isLoading: false, blockedReason: null, suspendedUntil: null };
});

function render(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(ui);
  });
  return container;
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route
            path="/private"
            element={<p>private content</p>}
          />
        </Route>
        <Route
          path="/auth"
          element={<p>auth page</p>}
        />
        <Route
          path="/banned"
          element={<p>banned page</p>}
        />
        <Route
          path="/suspended"
          element={<p>suspended page</p>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("shows loading state", () => {
    authState.current.isLoading = true;

    expect(renderGuard().textContent).toContain("Cargando");
  });

  it("redirects unauthenticated users", () => {
    expect(renderGuard().textContent).toContain("auth page");
  });

  it("redirects blocked users", () => {
    authState.current.blockedReason = "banned";
    expect(renderGuard().textContent).toContain("banned page");

    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = "";

    authState.current.blockedReason = "suspended";
    authState.current.suspendedUntil = "2026-07-01T00:00:00Z";
    expect(renderGuard().textContent).toContain("suspended page");
  });

  it("renders nested routes for authenticated users", () => {
    authState.current.isAuthenticated = true;

    expect(renderGuard().textContent).toContain("private content");
  });
});
