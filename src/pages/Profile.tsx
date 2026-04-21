import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GitPullRequest, Star, MessageSquare, CheckCircle2, XCircle, Loader2, Sparkles, ArrowLeft, TrendingUp, Calendar, X } from 'lucide-react';
import { subDays, subMonths, isAfter, format, startOfDay, endOfDay } from 'date-fns';
import { useUserProfile } from '../hooks/useUserProfile';
import { usePageTitle } from '../hooks/usePageTitle';
import { ContributionGraph } from '../components/ContributionGraph';
import { PRCard } from '../components/PRCard';
import { useSettingsStore } from '../store/settings';
import { buildPrWebUrl } from '../api/client';

const PROFILE_LIMITS = [200, 500, 1000, 2000];

export function Profile() {
  const { userId = '' } = useParams<{ userId: string }>();
  const [fetchLimit, setFetchLimit] = useState(500);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [activityRange, setActivityRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
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
          <ContributionGraph
            data={contributionData.data}
            selectedDay={selectedDay}
            onDayClick={setSelectedDay}
          />
        </div>
      )}

      {/* Activity in time range */}
      {prs.data && (
        <ActivityRange
          created={prs.data.created}
          reviewed={prs.data.reviewed}
          selectedDay={selectedDay}
          activityRange={activityRange}
          setActivityRange={setActivityRange}
          onClearDay={() => setSelectedDay(null)}
          userId={userId}
        />
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

type PRItem = {
  pullRequestId: number;
  title: string;
  status: string;
  isDraft: boolean;
  createdBy: { id: string; displayName: string; uniqueName: string; imageUrl: string };
  creationDate: string;
  closedDate?: string;
  mergeStatus?: string;
  repository: { id: string; name: string; webUrl: string; project: { id: string; name: string } };
  sourceRefName: string;
  targetRefName: string;
  reviewers: { id: string; displayName: string; uniqueName: string; imageUrl: string; vote: number; isRequired?: boolean }[];
  labels?: { id: string; name: string; active: boolean }[];
};

const RANGE_OPTIONS: { value: '7d' | '30d' | '90d' | '1y'; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
];

function getRangeCutoff(range: '7d' | '30d' | '90d' | '1y'): Date {
  const now = new Date();
  switch (range) {
    case '7d': return subDays(now, 7);
    case '30d': return subDays(now, 30);
    case '90d': return subMonths(now, 3);
    case '1y': return subDays(now, 365);
  }
}

function ActivityRange({
  created,
  reviewed,
  selectedDay,
  activityRange,
  setActivityRange,
  onClearDay,
  userId,
}: {
  created: PRItem[];
  reviewed: PRItem[];
  selectedDay: string | null;
  activityRange: '7d' | '30d' | '90d' | '1y';
  setActivityRange: (r: '7d' | '30d' | '90d' | '1y') => void;
  onClearDay: () => void;
  userId: string;
}) {
  const isDay = selectedDay !== null;
  const heading = isDay
    ? `Activity on ${format(new Date(selectedDay + 'T00:00:00'), 'MMM d, yyyy')}`
    : `Activity in the last ${RANGE_OPTIONS.find((r) => r.value === activityRange)?.label}`;

  const filteredCreated = useMemo(() => {
    if (isDay) {
      const dayStart = startOfDay(new Date(selectedDay + 'T00:00:00'));
      const dayEnd = endOfDay(dayStart);
      return created.filter((pr) => {
        const d = new Date(pr.creationDate);
        return isAfter(d, dayStart) && d <= dayEnd;
      });
    }
    const cutoff = getRangeCutoff(activityRange);
    return created.filter((pr) => isAfter(new Date(pr.creationDate), cutoff));
  }, [created, selectedDay, isDay, activityRange]);

  const filteredReviewed = useMemo(() => {
    if (isDay) {
      const dayStart = startOfDay(new Date(selectedDay + 'T00:00:00'));
      const dayEnd = endOfDay(dayStart);
      return reviewed.filter((pr) => {
        const d = new Date(pr.creationDate);
        return isAfter(d, dayStart) && d <= dayEnd;
      });
    }
    const cutoff = getRangeCutoff(activityRange);
    return reviewed.filter((pr) => isAfter(new Date(pr.creationDate), cutoff));
  }, [reviewed, selectedDay, isDay, activityRange]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {heading}
        </h2>
        <div className="flex items-center gap-2">
          {isDay && (
            <button
              onClick={onClearDay}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-ado-blue transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
          {!isDay && (
            <div className="flex gap-1">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setActivityRange(r.value)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    activityRange === r.value
                      ? 'bg-ado-blue text-white'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatCard label="PRs Created" value={filteredCreated.length} />
        <StatCard label="PRs Reviewed" value={filteredReviewed.length} />
      </div>

      {(filteredCreated.length > 0 || filteredReviewed.length > 0) && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filteredCreated.map((pr) => (
            <MiniPrRow key={`c-${pr.pullRequestId}`} pr={pr} label="created" userId={userId} />
          ))}
          {filteredReviewed.map((pr) => {
            const vote = pr.reviewers.find((r) => r.id === userId)?.vote ?? 0;
            const label = vote >= 10 ? 'approved' : vote >= 5 ? 'approved w/ suggestions' : vote <= -10 ? 'rejected' : 'waiting';
            return <MiniPrRow key={`r-${pr.pullRequestId}`} pr={pr} label={label} userId={userId} />;
          })}
        </div>
      )}

      {filteredCreated.length === 0 && filteredReviewed.length === 0 && (
        <p className="text-sm text-zinc-400 text-center py-4">No activity in this period.</p>
      )}
    </div>
  );
}

function MiniPrRow({ pr, label }: { pr: PRItem; label: string; userId: string }) {
  const org = useSettingsStore((s) => s.organization);
  const webUrl = buildPrWebUrl(org, pr.repository.project.name, pr.repository.name, pr.pullRequestId);

  return (
    <a
      href={webUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-sm"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
          label === 'created' ? 'bg-ado-blue/10 text-ado-blue'
          : label === 'approved' || label === 'approved w/ suggestions' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : label === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
        }`}>
          {label}
        </span>
        <span className="truncate">{pr.title}</span>
      </div>
      <span className="text-xs text-zinc-400 flex-shrink-0 ml-2">{pr.repository.name}</span>
    </a>
  );
}
