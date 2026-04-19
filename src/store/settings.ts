import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthMode } from '../auth/useAuth';

interface SettingsState {
  organization: string;
  authMode: AuthMode;
  pat: string;
  userId: string;
  userDisplayName: string;
  theme: 'light' | 'dark' | 'system';
  setOrganization: (org: string) => void;
  setAuthMode: (mode: AuthMode) => void;
  setPat: (pat: string) => void;
  setUser: (id: string, displayName: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      organization: '',
      authMode: 'oauth',
      pat: '',
      userId: '',
      userDisplayName: '',
      theme: 'system',
      setOrganization: (organization) => set({ organization }),
      setAuthMode: (authMode) => set({ authMode }),
      setPat: (pat) => set({ pat }),
      setUser: (userId, userDisplayName) => set({ userId, userDisplayName }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'prscope-settings' }
  )
);
