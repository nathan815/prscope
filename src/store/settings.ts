import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthMode } from '../auth/useAuth';

interface SettingsState {
  organization: string;
  authMode: AuthMode;
  pat: string;
  azCliAuthenticated: boolean;
  userId: string;
  userDisplayName: string;
  theme: 'light' | 'dark' | 'system';
  maxPRs: number;
  setOrganization: (org: string) => void;
  setAuthMode: (mode: AuthMode) => void;
  setPat: (pat: string) => void;
  setAzCliAuthenticated: (v: boolean) => void;
  setUser: (id: string, displayName: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setMaxPRs: (n: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      organization: '',
      authMode: 'az-cli',
      pat: '',
      azCliAuthenticated: false,
      userId: '',
      userDisplayName: '',
      theme: 'system',
      maxPRs: 2000,
      setOrganization: (organization) => set({ organization }),
      setAuthMode: (authMode) => set({ authMode }),
      setPat: (pat) => set({ pat }),
      setAzCliAuthenticated: (azCliAuthenticated) => set({ azCliAuthenticated }),
      setUser: (userId, userDisplayName) => set({ userId, userDisplayName }),
      setTheme: (theme) => set({ theme }),
      setMaxPRs: (maxPRs) => set({ maxPRs }),
    }),
    { name: 'prscope-settings' }
  )
);
