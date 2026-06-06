import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminRoute } from "@/router/AdminRoute";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: false,
    isLoading: false,
    user: null as { user_role?: string } | null,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState.current,
}));

let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  authState.current = { isAuthenticated: false, isLoading: false, user: null };
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
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route
            path="/admin"
            element={<p>admin content</p>}
          />
        </Route>
        <Route
          path="/auth"
          element={<p>auth page</p>}
        />
        <Route
          path="/403"
          element={<p>forbidden page</p>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminRoute", () => {
  it("shows loading state", () => {
    authState.current.isLoading = true;

    expect(renderGuard().textContent).toContain("Cargando");
  });

  it("redirects unauthenticated users", () => {
    expect(renderGuard().textContent).toContain("auth page");
  });

  it("redirects non-admin users", () => {
    authState.current = { isAuthenticated: true, isLoading: false, user: { user_role: "user" } };

    expect(renderGuard().textContent).toContain("forbidden page");
  });

  it("renders nested routes for admin users", () => {
    authState.current = { isAuthenticated: true, isLoading: false, user: { user_role: "admin" } };

    expect(renderGuard().textContent).toContain("admin content");
  });
});
