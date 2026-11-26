import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isServerDown, waitForServer } from "../lib/api";
import type { Me } from "../lib/types";

type AuthState = {
  user: Me | null;
  loading: boolean;
  /** How many times in a row the server couldn't be reached while starting up. */
  serverWaits: number;
  /** True when the server never answered, even after waiting. */
  serverUnreachable: boolean;
  retry: () => void;
  signInWithGoogle: (credential: string) => Promise<void>;
  signInAsDemo: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: Me | null }>("/auth/me").then((r) => r.user),
    staleTime: Infinity,
    ...waitForServer,
  });

  const onSignedIn = (user: Me) => {
    qc.clear();
    qc.setQueryData(["me"], user);
  };

  const google = useMutation({
    mutationFn: (credential: string) => api<{ user: Me }>("/auth/google", { body: { credential } }),
    onSuccess: (r) => onSignedIn(r.user),
  });
  const demo = useMutation({
    mutationFn: () => api<{ user: Me }>("/auth/demo", { method: "POST" }),
    onSuccess: (r) => onSignedIn(r.user),
  });
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(["me"], null);
    },
  });

  const value: AuthState = {
    user: me.data ?? null,
    loading: me.isLoading,
    serverWaits: me.failureCount,
    serverUnreachable: me.isError && isServerDown(me.error),
    retry: () => void me.refetch(),
    signInWithGoogle: async (c) => void (await google.mutateAsync(c)),
    signInAsDemo: async () => void (await demo.mutateAsync()),
    signOut: async () => void (await logout.mutateAsync()),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
