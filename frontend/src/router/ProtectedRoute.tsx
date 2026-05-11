import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.ts";

/**
 * Guards nested routes by redirecting unauthenticated users to the auth page.
 * @returns A loading state, redirect, or nested outlet.
 */
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-body-lg text-subtle">Cargando…</p>
      </div>
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
