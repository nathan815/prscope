import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FavoriteRepo } from '../types';

interface FavoritesState {
  repos: FavoriteRepo[];
  addRepo: (repo: FavoriteRepo) => void;
  removeRepo: (repoId: string) => void;
  isFavorite: (repoId: string) => boolean;
  toggleRepo: (repo: FavoriteRepo) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      repos: [],
      addRepo: (repo) =>
        set((s) => ({
          repos: s.repos.some((r) => r.repoId === repo.repoId) ? s.repos : [...s.repos, repo],
        })),
      removeRepo: (repoId) =>
        set((s) => ({ repos: s.repos.filter((r) => r.repoId !== repoId) })),
      isFavorite: (repoId) => get().repos.some((r) => r.repoId === repoId),
      toggleRepo: (repo) => {
        if (get().isFavorite(repo.repoId)) {
          get().removeRepo(repo.repoId);
        } else {
          get().addRepo(repo);
        }
      },
    }),
    { name: 'prscope-favorites' }
  )
);
