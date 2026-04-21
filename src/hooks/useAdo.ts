import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSettingsStore } from '../store/settings';
import { useFollowsStore } from '../store/follows';
import * as api from '../api/client';
import { configureClient } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { useSelectedProjectsStore } from '../store/selectedProjects';
import { getFeedCache, setFeedCache, type CachedFeedItem } from '../api/feedCache';
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

export function useMyPullRequests(status: string = 'active', minTime?: string) {
  const { isConfigured, userId } = useConfiguredClient();
  const selectedProjects = useSelectedProjectsStore((s) => s.projects);
  const maxPRs = useSettingsStore((s) => s.maxPRs);

  const queries = useQuery({
    queryKey: ['myPullRequests', status, userId, selectedProjects.map((p) => p.name), maxPRs, minTime],
    queryFn: async () => {
      if (!userId || selectedProjects.length === 0) return { created: [], reviewing: [] };

      const results = await Promise.all(
        selectedProjects.map(async (project) => {
          const [created, reviewing] = await Promise.all([
            api.getProjectPullRequests(project.name, { status, creatorId: userId, top: maxPRs, minTime }),
            api.getProjectPullRequests(project.name, { status, reviewerId: userId, top: maxPRs, minTime }),
          ]);
          return { created, assigned: reviewing };
        })
      );

      const created = results.flatMap((r) => r.created);
      const assigned = results.flatMap((r) => r.assigned);
      const createdIds = new Set(created.map((pr) => pr.pullRequestId));
      const assignedOnly = assigned.filter((pr) => !createdIds.has(pr.pullRequestId));

      const sortByLatest = (a: { closedDate?: string; creationDate: string }, b: { closedDate?: string; creationDate: string }) => {
        const aTime = new Date(a.closedDate ?? a.creationDate).getTime();
        const bTime = new Date(b.closedDate ?? b.creationDate).getTime();
        return bTime - aTime;
      };

      return {
        created: created.sort(sortByLatest),
        assigned: assignedOnly.sort(sortByLatest),
      };
    },
    enabled: isConfigured && (userId?.length ?? 0) > 0 && selectedProjects.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  return queries;
}

export function useFeedActivity() {
  const { isConfigured, userId } = useConfiguredClient();
  const follows = useFollowsStore((s) => s.users);
  const selectedProjects = useSelectedProjectsStore((s) => s.projects);
  const userName = useSettingsStore((s) => s.userDisplayName);
  const forceFullRef = useRef(false);

  const followIds = follows.map((f) => f.id);
  const projectNames = selectedProjects.map((p) => p.name);

  const query = useQuery({
    queryKey: ['feedActivity', userId, followIds, projectNames],
    queryFn: async () => {
      if (selectedProjects.length === 0) return [];

      const allUsers = [
        ...(userId ? [{ id: userId, displayName: userName, uniqueName: '', imageUrl: '', isSelf: true }] : []),
        ...follows.map((u) => ({ ...u, isSelf: false })),
      ];

      const cached = forceFullRef.current ? null : await getFeedCache(userId ?? '', followIds, projectNames);
      forceFullRef.current = false;

      let minTime: string | undefined;
      if (cached && cached.length > 0) {
        const newest = cached.reduce((latest, item) =>
          item.timestamp > latest ? item.timestamp : latest, cached[0]!.timestamp);
        const cutoff = new Date(newest);
        cutoff.setDate(cutoff.getDate() - 1);
        cutoff.setHours(0, 0, 0, 0);
        minTime = cutoff.toISOString();
      }

      const freshItems: CachedFeedItem[] = [];

      await Promise.all(
        allUsers.map(async (user) => {
          await Promise.all(
            selectedProjects.map(async (project) => {
              const queries: Promise<Awaited<ReturnType<typeof api.getProjectPullRequests>>>[] = [
                api.getProjectPullRequests(project.name, {
                  status: 'active',
                  creatorId: user.id,
                  top: minTime ? 15 : 30,
                  minTime,
                }),
                api.getProjectPullRequests(project.name, {
                  status: 'completed',
                  creatorId: user.id,
                  top: minTime ? 15 : 30,
                  minTime,
                }),
                api.getProjectPullRequests(project.name, {
                  status: 'all',
                  reviewerId: user.id,
                  top: minTime ? 25 : 50,
                  minTime,
                }),
              ];
              const [createdActive = [], createdCompleted = [], reviewing = []] = await Promise.all(queries);
              const created = [...createdActive, ...createdCompleted];

              for (const pr of created) {
                freshItems.push({
                  id: `${user.id}-created-${pr.pullRequestId}`,
                  type: 'pr_created',
                  user: pr.createdBy,
                  pullRequest: pr,
                  timestamp: pr.creationDate,
                  timestampLabel: 'created',
                  isSelf: user.isSelf,
                });
                if (pr.status === 'completed' && pr.closedDate) {
                  freshItems.push({
                    id: `${user.id}-completed-${pr.pullRequestId}`,
                    type: 'pr_completed',
                    user: pr.createdBy,
                    pullRequest: pr,
                    timestamp: pr.closedDate,
                    timestampLabel: 'completed',
                    isSelf: user.isSelf,
                  });
                }
              }

              for (const pr of reviewing) {
                if (pr.createdBy.id === user.id) continue;
                const review = pr.reviewers.find((r) => r.id === user.id);
                if (!review || review.vote === 0) continue;
                const type = review.vote >= 10 ? 'pr_approved' as const
                  : review.vote >= 5 ? 'pr_approved_suggestions' as const
                  : review.vote <= -10 ? 'pr_rejected' as const
                  : 'pr_waiting' as const;
                freshItems.push({
                  id: `${user.id}-review-${pr.pullRequestId}`,
                  type,
                  user: user.isSelf ? pr.reviewers.find((r) => r.id === user.id)! : { id: user.id, displayName: user.displayName, uniqueName: user.uniqueName, imageUrl: user.imageUrl },
                  pullRequest: pr,
                  timestamp: pr.closedDate ?? pr.creationDate,
                  timestampLabel: pr.closedDate ? 'completed' : 'created',
                  isSelf: user.isSelf,
                });
              }
            })
          );
        })
      );

      const freshById = new Map(freshItems.map((item) => [item.id, item]));
      const merged: CachedFeedItem[] = [];

      if (cached) {
        for (const item of cached) {
          const fresh = freshById.get(item.id);
          merged.push(fresh ?? item);
          if (fresh) freshById.delete(item.id);
        }
      }
      for (const item of freshById.values()) {
        merged.push(item);
      }

      const typePriority: Record<string, number> = {
        pr_completed: 0,
        pr_approved: 1,
        pr_approved_suggestions: 1,
        pr_rejected: 1,
        pr_waiting: 1,
        pr_created: 2,
      };
      merged.sort((a, b) => {
        const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (typePriority[a.type] ?? 1) - (typePriority[b.type] ?? 1);
      });

      await setFeedCache(userId ?? '', followIds, projectNames, merged);
      return merged;
    },
    enabled: isConfigured && selectedProjects.length > 0,
    staleTime: 1000 * 60 * 3,
  });

  const forceRefresh = () => {
    forceFullRef.current = true;
    query.refetch();
  };

  return { ...query, forceRefresh };
}
