import { Outlet, ScrollRestoration } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext.tsx";

/**
 * Wraps the router outlet with global providers.
 * @returns Provider-wrapped outlet for nested routes.
 */
function RootProvider() {
  return (
    <AuthProvider>
      <Outlet />
      <ScrollRestoration />
    </AuthProvider>
  );
}

export { RootProvider };
