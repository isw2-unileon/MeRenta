import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.ts";

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
