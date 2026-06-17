"use client";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiClient } from "../api/client";
import { auth } from "../firebase";

interface AuthUser {
  uid: string;
  email: string | null;
  getIdToken: () => Promise<string>;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  api: ApiClient | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function hasE2eBypassFlag(): boolean {
  if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "true") {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem("clinic-ai-e2e-auth-bypass") === "true";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const isE2eBypass = hasE2eBypassFlag();
  const [user, setUser] = useState<AuthUser | null>(
    isE2eBypass
      ? {
          uid: "staff-e2e",
          email: "staff@example.com",
          getIdToken: () => Promise.resolve("e2e-token"),
        }
      : null,
  );
  const [isLoading, setIsLoading] = useState(!isE2eBypass);

  useEffect(() => {
    if (isE2eBypass) {
      return undefined;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
  }, [isE2eBypass]);

  const api = useMemo(() => {
    if (!user) {
      return null;
    }

    return new ApiClient({
      getIdToken: () => user.getIdToken(),
    });
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      api,
      signOut: () => (isE2eBypass ? Promise.resolve() : signOut(auth)),
    }),
    [api, isE2eBypass, isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return value;
}
