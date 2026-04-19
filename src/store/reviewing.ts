import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReviewingPRsState {
  prIds: Set<string>;
  add: (prKey: string) => void;
  remove: (prKey: string) => void;
  isReviewing: (prKey: string) => boolean;
  toggle: (prKey: string) => void;
}

function serializeSet(set: Set<string>): string[] {
  return Array.from(set);
}

function deserializeSet(arr: string[]): Set<string> {
  return new Set(arr);
}

export const useReviewingStore = create<ReviewingPRsState>()(
  persist(
    (set, get) => ({
      prIds: new Set<string>(),
      add: (prKey) =>
        set((s) => ({ prIds: new Set(s.prIds).add(prKey) })),
      remove: (prKey) =>
        set((s) => {
          const next = new Set(s.prIds);
          next.delete(prKey);
          return { prIds: next };
        }),
      isReviewing: (prKey) => get().prIds.has(prKey),
      toggle: (prKey) => {
        if (get().isReviewing(prKey)) {
          get().remove(prKey);
        } else {
          get().add(prKey);
        }
      },
    }),
    {
      name: 'prscope-reviewing',
      storage: {
        getItem: (name) => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          const parsed = JSON.parse(raw) as { state: { prIds: string[] }; version: number };
          return {
            ...parsed,
            state: { ...parsed.state, prIds: deserializeSet(parsed.state.prIds) },
          };
        },
        setItem: (name, value) => {
          const serialized = {
            ...value,
            state: { ...value.state, prIds: serializeSet(value.state.prIds as unknown as Set<string>) },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

export function prKey(projectName: string, repoName: string, prId: number): string {
  return `${projectName}/${repoName}/${prId}`;
}
