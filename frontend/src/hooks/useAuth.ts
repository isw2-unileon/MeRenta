import { use } from "react";
import { AuthContext } from "@/context/AuthContext";

/**
 * Provides the current authentication context and guards against missing provider usage.
 * @returns Auth state and actions from the provider.
 */
function useAuth() {
  const context = use(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

export { useAuth };
