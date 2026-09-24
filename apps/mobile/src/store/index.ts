import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storageAdapter } from "@/lib/storage";
import type { SessionUser } from "@/types";

interface AuthState {
  user: SessionUser | null;
  isLoading: boolean;
  setUser: (user: SessionUser | null) => void;
  setLoading: (v: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      clear: () => set({ user: null, isLoading: false }),
    }),
    {
      name: "athena-auth",
      storage: createJSONStorage(() => storageAdapter),
      // Only restore the last session user; keep isLoading true until Firebase
      // auth settles in AuthBootstrap (app/_layout.tsx).
      partialize: (s) => ({ user: s.user }),
    },
  ),
);
