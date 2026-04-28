import { createContext, useState } from "react";
import * as React from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { name: string } | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: false,
  user: null,
  login: () => {},
  logout: () => {},
});

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated] = useState(true);
  const [isLoading] = useState(false);
  const [user] = useState({ name: "Ana G." });

  const login = () => {};
  const logout = () => {};

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export { AuthContext, AuthProvider };
