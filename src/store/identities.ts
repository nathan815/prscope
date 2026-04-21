import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface IdentityRecord {
  id: string;
  displayName: string;
  uniqueName: string;
  imageUrl: string;
  lastSeen: number;
}

const STALE_MS = 2 * 24 * 60 * 60 * 1000;

interface IdentityState {
  records: Record<string, IdentityRecord>;
  upsert: (identity: Omit<IdentityRecord, 'lastSeen'>) => void;
  upsertMany: (identities: Omit<IdentityRecord, 'lastSeen'>[]) => void;
  get: (userId: string) => IdentityRecord | undefined;
  isStale: (userId: string) => boolean;
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set, get) => ({
      records: {},
      upsert: (identity) => {
        if (!identity.id || !identity.displayName) return;
        set((s) => ({
          records: {
            ...s.records,
            [identity.id]: { ...identity, lastSeen: Date.now() },
          },
        }));
      },
      upsertMany: (identities) => {
        const now = Date.now();
        const updates: Record<string, IdentityRecord> = {};
        for (const id of identities) {
          if (id.id && id.displayName) {
            updates[id.id] = { ...id, lastSeen: now };
          }
        }
        if (Object.keys(updates).length === 0) return;
        set((s) => ({ records: { ...s.records, ...updates } }));
      },
      get: (userId) => get().records[userId],
      isStale: (userId) => {
        const record = get().records[userId];
        if (!record) return true;
        return Date.now() - record.lastSeen > STALE_MS;
      },
    }),
    { name: 'prscope-identities' }
  )
);
