import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GitPullRequest, Star, MessageSquare, CheckCircle2, XCircle, Loader2, Sparkles, ArrowLeft, TrendingUp } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { usePageTitle } from '../hooks/usePageTitle';
import { ContributionGraph } from '../components/ContributionGraph';
import { PRCard } from '../components/PRCard';

const PROFILE_LIMITS = [200, 500, 1000, 2000];

export function Profile() {
  const { userId = '' } = useParams<{ userId: string }>();
  const [fetchLimit, setFetchLimit] = useState(500);
  const { prs, topRepos, contributionData, reviewImpact, isConfigured } = useUserProfile(userId, fetchLimit);

  const userName = prs.data?.created?.[0]?.createdBy.displayName
    ?? prs.data?.reviewed?.[0]?.reviewers.find((r) => r.id === userId)?.displayName
    ?? userId;

  usePageTitle(userName);

  const stats = useMemo(() => {
    if (!prs.data) return null;
    const created = prs.data.created;
    const reviewed = prs.data.reviewed;
    const completedOwn = created.filter((pr) => pr.status === 'completed').length;
    return {
      totalCreated: created.length,
      totalReviewed: reviewed.length,
      completedOwn,
      activeOwn: created.filter((pr) => pr.status === 'active').length,
      completionRate: created.length > 0 ? completedOwn / created.length : 0,
    };
  }, [prs.data]);

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        Select projects first.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-ado-blue mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          {prs.data?.created?.[0]?.createdBy.imageUrl ? (
            <img
              src={prs.data.created[0].createdBy.imageUrl}
              alt={userName}
              className="w-16 h-16 rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-ado-blue/10 flex items-center justify-center text-2xl font-bold text-ado-blue">
              {userName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{userName}</h1>
            {prs.data?.created?.[0]?.createdBy.uniqueName && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{prs.data.created[0].createdBy.uniqueName}</p>
            )}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-4 mt-6">
            <StatCard label="PRs Created" value={stats.totalCreated} />
            <StatCard label="PRs Reviewed" value={stats.totalReviewed} />
            <StatCard label="Active PRs" value={stats.activeOwn} />
            <StatCard label="Completion Rate" value={`${Math.round(stats.completionRate * 100)}%`} />
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-zinc-400">
            Showing up to {fetchLimit.toLocaleString()} most recent PRs{prs.isLoading ? '' : ` (${stats?.totalCreated ?? 0} created, ${stats?.totalReviewed ?? 0} reviewed fetched)`}
            {((stats?.totalCreated ?? 0) >= fetchLimit || (stats?.totalReviewed ?? 0) >= fetchLimit) && (
              <span className="text-amber-500 ml-1">— limit reached, increase to see more</span>
            )}
          </p>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-zinc-400 mr-1">Limit:</span>
            {PROFILE_LIMITS.map((n) => (
              <button
                key={n}
                onClick={() => setFetchLimit(n)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  fetchLimit === n
                    ? 'bg-ado-blue text-white'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {n.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contribution Graph */}
      {contributionData.data && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            PR Activity
          </h2>
          <ContributionGraph data={contributionData.data} />
        </div>
      )}

      {/* Top Repos */}
      {topRepos.data && topRepos.data.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Top Repositories
          </h2>
          <div className="space-y-2">
            {topRepos.data.map((repo) => (
              <div key={`${repo.project}/${repo.name}`} className="flex items-center justify-between py-1.5">
                <div className="text-sm">
                  <span className="font-medium">{repo.name}</span>
                  <span className="text-xs text-zinc-400 ml-2">{repo.project}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <GitPullRequest className="w-3 h-3" />
                    {repo.created} created
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {repo.reviewed} reviewed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Impact */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Review Impact
        </h2>
        {reviewImpact.isLoading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing review threads...
          </div>
        )}
        {reviewImpact.data && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <StatCard label="Comments Left" value={reviewImpact.data.totalComments} />
              <StatCard label="Avg per PR" value={reviewImpact.data.avgCommentsPerPr.toFixed(1)} />
              <StatCard label="PR Completion Rate" value={`${Math.round(reviewImpact.data.completionRate * 100)}%`} />
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-600" />
                {reviewImpact.data.completedCount} completed
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-500" />
                {reviewImpact.data.abandonedCount} abandoned
              </span>
              <span>
                across {reviewImpact.data.totalPrsAnalyzed} recent reviewed PRs
              </span>
            </div>
            {reviewImpact.data.threadStatuses && Object.keys(reviewImpact.data.threadStatuses).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(reviewImpact.data.threadStatuses).map(([status, count]) => (
                  <span key={status} className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                    {status}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {!reviewImpact.isLoading && !reviewImpact.data && stats?.totalReviewed === 0 && (
          <p className="text-sm text-zinc-400">No review activity found.</p>
        )}
      </div>

      {/* AI Summary placeholder */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          AI Summary
        </h2>
        <button
          disabled
          className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-4 py-2 rounded-lg text-sm cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          Generate Summary (coming soon)
        </button>
        <p className="text-xs text-zinc-400 mt-2">Will use Copilot to summarize what this person works on and their review patterns.</p>
      </div>

      {/* Recent PRs */}
      {prs.data && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <GitPullRequest className="w-4 h-4" />
            Recent PRs Created ({prs.data.created.length})
          </h2>
          {prs.isLoading && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          )}
          <div className="space-y-3">
            {prs.data.created.slice(0, 20).map((pr) => (
              <PRCard key={pr.pullRequestId} pr={pr} showReviewToggle={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{label}</div>
    </div>
  );
}
