import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../store/settings';
import { useFavoritesStore } from '../store/favorites';
import { useFollowsStore } from '../store/follows';
import * as api from '../api/client';
import { configureClient } from '../api/client';
import { useAuth } from '../auth/useAuth';
import type { FavoriteRepo } from '../types';

function useConfiguredClient() {
  const organization = useSettingsStore((s) => s.organization);
  const { isAuthenticated, authMode, getToken, userId } = useAuth();
  configureClient(organization, authMode, getToken);
  return { organization, isConfigured: isAuthenticated, userId };
}

export function useConnectionData() {
  const { isConfigured } = useConfiguredClient();
  return useQuery({
    queryKey: ['connectionData'],
    queryFn: api.getConnectionData,
    enabled: isConfigured,
    staleTime: 1000 * 60 * 30,
  });
}

export function useProjects() {
  const { isConfigured } = useConfiguredClient();
  return useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
    enabled: isConfigured,
    staleTime: 1000 * 60 * 10,
  });
}

export function useRepositories(projectName: string) {
  const { isConfigured } = useConfiguredClient();
  return useQuery({
    queryKey: ['repositories', projectName],
    queryFn: () => api.getRepositories(projectName),
    enabled: isConfigured && projectName.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export function useMultiProjectRepositories(projectNames: string[]) {
  const { isConfigured } = useConfiguredClient();
  return useQuery({
    queryKey: ['repositories', ...projectNames],
    queryFn: async () => {
      const results = await Promise.all(
        projectNames.map((name) => api.getRepositories(name))
      );
      return results.flat().sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: isConfigured && projectNames.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePullRequests(
  favoriteRepo: FavoriteRepo,
  options: { status?: string; creatorId?: string; reviewerId?: string } = {}
) {
  const { isConfigured } = useConfiguredClient();
  return useQuery({
    queryKey: ['pullRequests', favoriteRepo.repoId, options],
    queryFn: () =>
      api.getPullRequests(favoriteRepo.projectName, favoriteRepo.repoId, options),
    enabled: isConfigured,
    staleTime: 1000 * 60 * 2,
  });
}

export function useMyPullRequests(status: string = 'active') {
  const { isConfigured, userId } = useConfiguredClient();
  const favorites = useFavoritesStore((s) => s.repos);

  const queries = useQuery({
    queryKey: ['myPullRequests', status, userId, favorites.map((f) => f.repoId)],
    queryFn: async () => {
      if (!userId || favorites.length === 0) return { created: [], reviewing: [] };

      const results = await Promise.all(
        favorites.map(async (repo) => {
          const [created, reviewing] = await Promise.all([
            api.getPullRequests(repo.projectName, repo.repoId, { status, creatorId: userId }),
            api.getPullRequests(repo.projectName, repo.repoId, { status, reviewerId: userId }),
          ]);
          return { created, reviewing };
        })
      );

      const created = results.flatMap((r) => r.created);
      const reviewing = results.flatMap((r) => r.reviewing);
      const createdIds = new Set(created.map((pr) => pr.pullRequestId));
      const reviewingOnly = reviewing.filter((pr) => !createdIds.has(pr.pullRequestId));

      return {
        created: created.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()),
        reviewing: reviewingOnly.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()),
      };
    },
    enabled: isConfigured && (userId?.length ?? 0) > 0 && favorites.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  return queries;
}

export function useFollowedUserActivity() {
  const { isConfigured } = useConfiguredClient();
  const follows = useFollowsStore((s) => s.users);
  const favorites = useFavoritesStore((s) => s.repos);

  return useQuery({
    queryKey: ['followedActivity', follows.map((f) => f.id), favorites.map((f) => f.repoId)],
    queryFn: async () => {
      if (follows.length === 0 || favorites.length === 0) return [];

      const items: {
        id: string;
        type: 'pr_created' | 'pr_completed' | 'pr_reviewed';
        user: { id: string; displayName: string; uniqueName: string; imageUrl: string };
        pullRequest: Awaited<ReturnType<typeof api.getPullRequests>>[0];
        timestamp: string;
      }[] = [];

      await Promise.all(
        follows.map(async (user) => {
          await Promise.all(
            favorites.map(async (repo) => {
              const [created, reviewing] = await Promise.all([
                api.getPullRequests(repo.projectName, repo.repoId, {
                  status: 'all',
                  creatorId: user.id,
                  top: 10,
                }),
                api.getPullRequests(repo.projectName, repo.repoId, {
                  status: 'all',
                  reviewerId: user.id,
                  top: 10,
                }),
              ]);

              for (const pr of created) {
                const type = pr.status === 'completed' ? 'pr_completed' as const : 'pr_created' as const;
                items.push({
                  id: `${user.id}-created-${pr.pullRequestId}`,
                  type,
                  user: pr.createdBy,
                  pullRequest: pr,
                  timestamp: pr.status === 'completed' && pr.closedDate ? pr.closedDate : pr.creationDate,
                });
              }

              for (const pr of reviewing) {
                if (pr.createdBy.id === user.id) continue;
                items.push({
                  id: `${user.id}-review-${pr.pullRequestId}`,
                  type: 'pr_reviewed',
                  user: { id: user.id, displayName: user.displayName, uniqueName: user.uniqueName, imageUrl: user.imageUrl },
                  pullRequest: pr,
                  timestamp: pr.creationDate,
                });
              }
            })
          );
        })
      );

      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return items;
    },
    enabled: isConfigured && follows.length > 0 && favorites.length > 0,
    staleTime: 1000 * 60 * 3,
  });
}
