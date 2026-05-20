"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "./lib/firebase-client";

export type SessionUser = {
  uid: string;
  email: string;
  name: string;
  role: string;
  claims: {
    admin: boolean;
    role: string | null;
  };
};

type AuthContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshSession() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store"
      });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = (await response.json()) as { user: SessionUser | null };
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  }

  async function signOutUser() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(firebaseAuth);
    setUser(null);
  }

  useEffect(() => {
    refreshSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, refreshSession, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
