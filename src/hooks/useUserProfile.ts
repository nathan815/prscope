import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { useSettingsStore } from '../store/settings';
import { useSelectedProjectsStore } from '../store/selectedProjects';
import * as api from '../api/client';
import { configureClient } from '../api/client';
import { useAuth } from '../auth/useAuth';

export function useUserProfile(userId: string, fetchLimit: number = 200, minTime?: string, maxTime?: string, reviewAnalysisLimit: number = 20) {
  const organization = useSettingsStore((s) => s.organization);
  const { isAuthenticated, authMode, getToken } = useAuth();
  const selectedProjects = useSelectedProjectsStore((s) => s.projects);

  configureClient(organization, authMode, getToken);
  const isConfigured = isAuthenticated && userId.length > 0 && selectedProjects.length > 0;

  const prsQuery = useQuery({
    queryKey: ['profile-prs', userId, selectedProjects.map((p) => p.name), fetchLimit, minTime, maxTime],
    queryFn: async () => {
      const results = await Promise.all(
        selectedProjects.map(async (project) => {
          const [created, reviewed] = await Promise.all([
            api.getProjectPullRequests(project.name, { status: 'all', creatorId: userId, top: fetchLimit, minTime, maxTime }),
            api.getProjectPullRequests(project.name, { status: 'all', reviewerId: userId, top: fetchLimit, minTime, maxTime }),
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

  const created = prsQuery.data?.created ?? [];
  const reviewed = prsQuery.data?.reviewed ?? [];

  const topRepos = useQuery({
    queryKey: ['profile-top-repos', userId, created.length, reviewed.length, minTime, maxTime],
    queryFn: () => {
      const counts = new Map<string, { name: string; project: string; created: number; reviewed: number }>();
      for (const pr of created) {
        const key = `${pr.repository.project.name}/${pr.repository.name}`;
        const entry = counts.get(key) ?? { name: pr.repository.name, project: pr.repository.project.name, created: 0, reviewed: 0 };
        entry.created++;
        counts.set(key, entry);
      }
      for (const pr of reviewed) {
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
    queryKey: ['profile-contributions', userId, created.length, reviewed.length, minTime, maxTime],
    queryFn: () => {
      const days = new Map<string, { created: number; reviewed: number }>();
      for (const pr of created) {
        const day = format(new Date(pr.creationDate), 'yyyy-MM-dd');
        const entry = days.get(day) ?? { created: 0, reviewed: 0 };
        entry.created++;
        days.set(day, entry);
      }
      for (const pr of reviewed) {
        const day = format(new Date(pr.creationDate), 'yyyy-MM-dd');
        const entry = days.get(day) ?? { created: 0, reviewed: 0 };
        entry.reviewed++;
        days.set(day, entry);
      }
      return days;
    },
    enabled: !!prsQuery.data,
    staleTime: Infinity,
  });

  const reviewedForImpact = useMemo(
    () => reviewed.slice(0, reviewAnalysisLimit),
    [reviewed, reviewAnalysisLimit]
  );

  const reviewImpact = useQuery({
    queryKey: ['profile-review-impact', userId, reviewedForImpact.map((p) => p.pullRequestId)],
    queryFn: async () => {
      if (reviewedForImpact.length === 0) {
        return { totalPrsAnalyzed: 0, totalComments: 0, prsWithComments: 0, avgCommentsPerPr: 0, completedCount: 0, abandonedCount: 0, completionRate: 0, threadStatuses: {} as Record<string, number>, commentTexts: [] as string[] };
      }
      const prs = reviewedForImpact;
      const threads = await Promise.all(
        prs.map(async (pr) => {
          try {
            const t = await api.getPullRequestThreads(
              pr.repository.project.name,
              pr.repository.id,
              pr.pullRequestId
            );
            return { threads: t };
          } catch {
            return { threads: [] };
          }
        })
      );

      let totalComments = 0;
      let prsWithComments = 0;
      const commentTexts: string[] = [];
      const threadStatuses = new Map<string, number>();
      const repoStats = new Map<string, { name: string; project: string; prsReviewed: number; comments: number }>();

      type ReviewEvent = { type: 'vote'; prId: number; prTitle: string; repo: string; project: string; vote: number; date: string }
        | { type: 'commented'; prId: number; prTitle: string; repo: string; project: string; count: number; date: string };

      const rawEvents: ReviewEvent[] = [];
      const commentsByPrDay = new Map<string, { prId: number; prTitle: string; repo: string; project: string; count: number; date: string }>();

      for (let i = 0; i < threads.length; i++) {
        const pr = prs[i]!;
        const { threads: prThreads } = threads[i]!;
        const repoKey = `${pr.repository.project.name}/${pr.repository.name}`;
        const repo = repoStats.get(repoKey) ?? { name: pr.repository.name, project: pr.repository.project.name, prsReviewed: 0, comments: 0 };
        repo.prsReviewed++;

        let prCommentCount = 0;
        for (const thread of prThreads) {
          if (thread.status) {
            threadStatuses.set(thread.status, (threadStatuses.get(thread.status) ?? 0) + 1);
          }

          const votedById = thread.properties?.['CodeReviewVotedByIdentity']?.['$value'];
          const voteResult = thread.properties?.['CodeReviewVoteResult']?.['$value'];
          const voteAuthorId = thread.comments?.[0]?.author?.id;
          if (votedById && voteResult && voteAuthorId === userId) {
            rawEvents.push({
              type: 'vote',
              prId: pr.pullRequestId,
              prTitle: pr.title,
              repo: pr.repository.name,
              project: pr.repository.project.name,
              vote: parseInt(voteResult),
              date: thread.publishedDate,
            });
          }

          for (const comment of thread.comments) {
            if (comment.author.id === userId && comment.commentType === 'text' && comment.content) {
              prCommentCount++;
              totalComments++;
              repo.comments++;
              if (commentTexts.length < 50) {
                commentTexts.push(comment.content.slice(0, 200));
              }
              const day = format(new Date(comment.publishedDate), 'yyyy-MM-dd');
              const groupKey = `${pr.pullRequestId}-${day}`;
              const existing = commentsByPrDay.get(groupKey);
              if (existing) {
                existing.count++;
                if (comment.publishedDate > existing.date) existing.date = comment.publishedDate;
              } else {
                commentsByPrDay.set(groupKey, {
                  prId: pr.pullRequestId,
                  prTitle: pr.title,
                  repo: pr.repository.name,
                  project: pr.repository.project.name,
                  count: 1,
                  date: comment.publishedDate,
                });
              }
            }
          }
        }
        if (prCommentCount > 0) prsWithComments++;
        repoStats.set(repoKey, repo);
      }

      for (const group of commentsByPrDay.values()) {
        rawEvents.push({ type: 'commented', ...group });
      }

      const reviewHistory = rawEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const completedCount = prs.filter((pr) => pr.status === 'completed').length;
      const abandonedCount = prs.filter((pr) => pr.status === 'abandoned').length;
      const repoBreakdown = Array.from(repoStats.values()).sort((a, b) => b.comments - a.comments);

      let approved = 0;
      let approvedWithSuggestions = 0;
      let waitingForAuthor = 0;
      let rejected = 0;
      for (const pr of prs) {
        const vote = pr.reviewers.find((r) => r.id === userId)?.vote ?? 0;
        if (vote >= 10) approved++;
        else if (vote >= 5) approvedWithSuggestions++;
        else if (vote <= -10) rejected++;
        else if (vote <= -5) waitingForAuthor++;
      }

      const voteEvents = reviewHistory.filter((e): e is Extract<typeof e, { type: 'vote' }> => e.type === 'vote');
      const prsWithVoteChanges = new Set<number>();
      const votesByPr = new Map<number, typeof voteEvents>();
      for (const v of voteEvents) {
        const existing = votesByPr.get(v.prId) ?? [];
        existing.push(v);
        votesByPr.set(v.prId, existing);
        if (existing.length > 1) prsWithVoteChanges.add(v.prId);
      }

      return {
        totalPrsAnalyzed: prs.length,
        totalComments,
        prsWithComments,
        avgCommentsPerPr: prs.length > 0 ? totalComments / prs.length : 0,
        completedCount,
        abandonedCount,
        completionRate: prs.length > 0 ? completedCount / prs.length : 0,
        approved,
        approvedWithSuggestions,
        waitingForAuthor,
        rejected,
        threadStatuses: Object.fromEntries(threadStatuses),
        commentTexts,
        repoBreakdown,
        reviewHistory,
        prsWithVoteChanges: prsWithVoteChanges.size,
      };
    },
    enabled: reviewedForImpact.length > 0,
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
