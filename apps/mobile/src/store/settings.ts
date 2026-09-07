import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storageAdapter } from "@/lib/storage";

interface SettingsState {
  apiUrlOverride: string | null;
  setApiUrlOverride: (url: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiUrlOverride: null,
      setApiUrlOverride: (apiUrlOverride) => set({ apiUrlOverride }),
    }),
    {
      name: "athena-settings",
      storage: createJSONStorage(() => storageAdapter),
      partialize: (s) => ({ apiUrlOverride: s.apiUrlOverride }),
    },
  ),
);
