import { Outlet } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext.tsx";

function RootProvider() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export { RootProvider };
