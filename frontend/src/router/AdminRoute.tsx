import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Guards admin-only routes.
 * Redirects unauthenticated users to /auth and non-admins to /403.
 */
function AdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-neutral-500">Cargando…</p>
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

  // The backend stores the role as "admin", not "customer"
  if (user?.user_role !== "admin") {
    return (
      <Navigate
        to="/403"
        replace
      />
    );
  }

  return <Outlet />;
}

export { AdminRoute };
