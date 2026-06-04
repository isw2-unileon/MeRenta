import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.ts";

/**
 * Guards nested routes.
 * - Redirects unauthenticated users to /auth.
 * - Redirects banned users to /banned.
 * - Redirects suspended users to /suspended (with optional ?until= param).
 */
function ProtectedRoute() {
  const { isAuthenticated, isLoading, blockedReason, suspendedUntil } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-body-lg text-subtle">Cargando…</p>
      </div>
    );
  }

  if (blockedReason === "banned") {
    return (
      <Navigate
        to="/banned"
        replace
      />
    );
  }

  if (blockedReason === "suspended") {
    const query = suspendedUntil ? `?until=${encodeURIComponent(suspendedUntil)}` : "";
    return (
      <Navigate
        to={`/suspended${query}`}
        replace
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth"
        replace
      />
    );
  }

  return <Outlet />;
}

export { ProtectedRoute };
