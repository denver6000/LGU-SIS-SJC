"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, signOut } from "firebase/auth";
import { firebaseAuth } from "./lib/firebase-client";
import type { SessionUser } from "./lib/shared/user";

type AuthContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser = null
}: {
  children: React.ReactNode;
  initialUser?: SessionUser | null;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);

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
    setIsLoading(true);
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(firebaseAuth);
    setUser(null);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!initialUser) {
      refreshSession();
      return;
    }

    setIsLoading(false);
  }, [initialUser]);

  useEffect(() => {
    return onIdTokenChanged(firebaseAuth, async (nextUser) => {
      if (!nextUser) return;

      const idToken = await nextUser.getIdToken();
      await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ idToken })
      }).catch(() => undefined);
    });
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
