import { useQuery } from '@tanstack/react-query';
import { subYears, startOfDay } from 'date-fns';
import { useSettingsStore } from '../store/settings';
import { useSelectedProjectsStore } from '../store/selectedProjects';
import * as api from '../api/client';
import { configureClient } from '../api/client';
import { useAuth } from '../auth/useAuth';

const ONE_YEAR_AGO = startOfDay(subYears(new Date(), 1)).toISOString();

export function useUserProfile(userId: string, fetchLimit: number = 200) {
  const organization = useSettingsStore((s) => s.organization);
  const { isAuthenticated, authMode, getToken } = useAuth();
  const selectedProjects = useSelectedProjectsStore((s) => s.projects);

  configureClient(organization, authMode, getToken);
  const isConfigured = isAuthenticated && userId.length > 0 && selectedProjects.length > 0;

  const prsQuery = useQuery({
    queryKey: ['profile-prs', userId, selectedProjects.map((p) => p.name), fetchLimit],
    queryFn: async () => {
      const results = await Promise.all(
        selectedProjects.map(async (project) => {
          const [created, reviewed] = await Promise.all([
            api.getProjectPullRequests(project.name, { status: 'all', creatorId: userId, top: fetchLimit, minTime: ONE_YEAR_AGO }),
            api.getProjectPullRequests(project.name, { status: 'all', reviewerId: userId, top: fetchLimit, minTime: ONE_YEAR_AGO }),
          ]);
          return { created, reviewed };
        })
      );

      const created = results.flatMap((r) => r.created);
      const reviewed = results.flatMap((r) => r.reviewed);
      const reviewedFiltered = reviewed.filter((pr) => {
        if (pr.createdBy.id === userId) return false;
        const vote = pr.reviewers.find((r) => r.id === userId)?.vote ?? 0;
        return vote !== 0;
      });

      return { created, reviewed: reviewedFiltered };
    },
    enabled: isConfigured,
    staleTime: 1000 * 60 * 5,
  });

  const topRepos = useQuery({
    queryKey: ['profile-top-repos', userId, prsQuery.data],
    queryFn: () => {
      const counts = new Map<string, { name: string; project: string; created: number; reviewed: number }>();
      for (const pr of prsQuery.data?.created ?? []) {
        const key = `${pr.repository.project.name}/${pr.repository.name}`;
        const entry = counts.get(key) ?? { name: pr.repository.name, project: pr.repository.project.name, created: 0, reviewed: 0 };
        entry.created++;
        counts.set(key, entry);
      }
      for (const pr of prsQuery.data?.reviewed ?? []) {
        const key = `${pr.repository.project.name}/${pr.repository.name}`;
        const entry = counts.get(key) ?? { name: pr.repository.name, project: pr.repository.project.name, created: 0, reviewed: 0 };
        entry.reviewed++;
        counts.set(key, entry);
      }
      return Array.from(counts.values())
        .map((r) => ({ ...r, total: r.created + r.reviewed }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
    enabled: !!prsQuery.data,
    staleTime: Infinity,
  });

  const contributionData = useQuery({
    queryKey: ['profile-contributions', userId, prsQuery.data],
    queryFn: () => {
      const days = new Map<string, { created: number; reviewed: number }>();
      for (const pr of prsQuery.data?.created ?? []) {
        const day = pr.creationDate.slice(0, 10);
        const entry = days.get(day) ?? { created: 0, reviewed: 0 };
        entry.created++;
        days.set(day, entry);
      }
      for (const pr of prsQuery.data?.reviewed ?? []) {
        const day = pr.creationDate.slice(0, 10);
        const entry = days.get(day) ?? { created: 0, reviewed: 0 };
        entry.reviewed++;
        days.set(day, entry);
      }
      return days;
    },
    enabled: !!prsQuery.data,
    staleTime: Infinity,
  });

  const reviewImpact = useQuery({
    queryKey: ['profile-review-impact', userId, prsQuery.data?.reviewed?.slice(0, 20).map((p) => p.pullRequestId)],
    queryFn: async () => {
      const prs = (prsQuery.data?.reviewed ?? []).slice(0, 20);
      const threads = await Promise.all(
        prs.map(async (pr) => {
          try {
            const t = await api.getPullRequestThreads(
              pr.repository.project.name,
              pr.repository.id,
              pr.pullRequestId
            );
            return { pr, threads: t };
          } catch {
            return { pr, threads: [] };
          }
        })
      );

      let totalComments = 0;
      let prsWithComments = 0;
      const commentTexts: string[] = [];
      const threadStatuses = new Map<string, number>();

      for (const { threads: prThreads } of threads) {
        let prCommentCount = 0;
        for (const thread of prThreads) {
          if (thread.status) {
            threadStatuses.set(thread.status, (threadStatuses.get(thread.status) ?? 0) + 1);
          }
          for (const comment of thread.comments) {
            if (comment.author.id === userId && comment.commentType === 'text') {
              prCommentCount++;
              totalComments++;
              if (commentTexts.length < 50) {
                commentTexts.push(comment.content.slice(0, 200));
              }
            }
          }
        }
        if (prCommentCount > 0) prsWithComments++;
      }

      const completedCount = prs.filter((pr) => pr.status === 'completed').length;
      const abandonedCount = prs.filter((pr) => pr.status === 'abandoned').length;

      return {
        totalPrsAnalyzed: prs.length,
        totalComments,
        prsWithComments,
        avgCommentsPerPr: prs.length > 0 ? totalComments / prs.length : 0,
        completedCount,
        abandonedCount,
        completionRate: prs.length > 0 ? completedCount / prs.length : 0,
        threadStatuses: Object.fromEntries(threadStatuses),
        commentTexts,
      };
    },
    enabled: !!prsQuery.data && (prsQuery.data?.reviewed?.length ?? 0) > 0,
    staleTime: 1000 * 60 * 10,
  });

  return {
    prs: prsQuery,
    topRepos,
    contributionData,
    reviewImpact,
    isConfigured,
  };
}
