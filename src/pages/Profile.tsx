import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  GitPullRequest,
  Star,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp,
  Calendar,
  X,
  UserPlus,
  UserMinus,
} from "lucide-react";
import {
  subDays,
  subMonths,
  subYears,
  isAfter,
  format,
  startOfDay,
  endOfDay,
  startOfYear,
  endOfYear,
  formatDistanceToNow,
} from "date-fns";
import { useUserProfile } from "../hooks/useUserProfile";
import { usePageTitle } from "../hooks/usePageTitle";
import { useIdentity } from "../hooks/useIdentity";
import { ContributionGraph } from "../components/ContributionGraph";
import { Skeleton, SkeletonCard } from "../components/Skeleton";
import { PRCard } from "../components/PRCard";
import { useFollowsStore } from "../store/follows";
import { useSettingsStore } from "../store/settings";
import { Avatar } from "../components/Avatar";
import { buildPrWebUrl } from "../api/client";
import { UserAiSummary } from "../components/UserAiSummary";

const PROFILE_LIMITS = [200, 500, 1000, 2000];

type TimeRange = "last-1y" | "last-6m" | "last-1m" | string; // string for year like "2025"

function getTimeRangeBounds(range: TimeRange): {
  minTime: string;
  maxTime?: string;
} {
  const now = new Date();
  if (range === "last-1y")
    return { minTime: startOfDay(subYears(now, 1)).toISOString() };
  if (range === "last-6m")
    return { minTime: startOfDay(subMonths(now, 6)).toISOString() };
  if (range === "last-1m")
    return { minTime: startOfDay(subMonths(now, 1)).toISOString() };
  const year = parseInt(range);
  return {
    minTime: startOfYear(new Date(year, 0, 1)).toISOString(),
    maxTime: endOfYear(new Date(year, 0, 1)).toISOString(),
  };
}

function buildTimeRangeOptions(): { value: TimeRange; label: string }[] {
  const currentYear = new Date().getFullYear();
  const options: { value: TimeRange; label: string }[] = [
    { value: "last-1y", label: "Past year" },
    { value: "last-6m", label: "Past 6 months" },
    { value: "last-1m", label: "Past month" },
  ];
  for (let y = currentYear; y >= currentYear - 4; y--) {
    options.push({ value: String(y), label: String(y) });
  }
  return options;
}

const TIME_RANGE_OPTIONS = buildTimeRangeOptions();

function getTimeRangeLabel(range: TimeRange): string {
  return TIME_RANGE_OPTIONS.find((r) => r.value === range)?.label ?? range;
}

export function Profile() {
  const { userId = "" } = useParams<{ userId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const timeRange = (searchParams.get("range") as TimeRange) || "last-1y";
  const fetchLimit = Number(searchParams.get("limit")) || 500;
  const selectedDay = searchParams.get("day") || null;
  const reviewAnalysisLimit = Number(searchParams.get("rlimit")) || 50;
  const [activityRange, setActivityRange] = useState<
    "7d" | "30d" | "90d" | "1y"
  >("30d");
  const [reviewRepoFilter, setReviewRepoFilter] = useState<string | null>(null);
  const [reviewHistoryVisible, setReviewHistoryVisible] = useState(100);

  const setParam = (updates: Record<string, string | null>) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  };

  const bounds = useMemo(() => getTimeRangeBounds(timeRange), [timeRange]);
  const { prs, topRepos, contributionData, reviewImpact, isConfigured } =
    useUserProfile(
      userId,
      fetchLimit,
      bounds.minTime,
      bounds.maxTime,
      reviewAnalysisLimit,
    );

  const { data: userInfo } = useIdentity(userId);
  const userName = userInfo?.displayName ?? null;

  usePageTitle(userName ?? "Profile");

  const stats = useMemo(() => {
    if (!prs.data) return null;
    const created = prs.data.created;
    const reviewed = prs.data.reviewed;
    const completedPRs = created.filter(
      (pr) => pr.status === "completed" && pr.closedDate,
    );
    const daysToMerge = completedPRs.map((pr) => {
      const created = new Date(pr.creationDate).getTime();
      const closed = new Date(pr.closedDate!).getTime();
      return (closed - created) / (1000 * 60 * 60 * 24);
    });
    daysToMerge.sort((a, b) => a - b);
    const medianDaysToMerge =
      daysToMerge.length > 0
        ? daysToMerge[Math.floor(daysToMerge.length / 2)]!
        : 0;

    return {
      totalCreated: created.length,
      totalReviewed: reviewed.length,
      completedOwn: completedPRs.length,
      activeOwn: created.filter((pr) => pr.status === "active").length,
      medianDaysToMerge,
    };
  }, [prs.data]);

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        Select projects first.
      </div>
    );
  }

  if (prs.isLoading && !userInfo) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} className="p-3 h-16" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading profile data...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <Avatar
            name={userName ?? "?"}
            imageUrl={userInfo?.imageUrl}
            size={16}
            hiRes
          />
          <div>
            <h1 className="text-2xl font-bold">{userName ?? userId}</h1>
            {userInfo?.uniqueName && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {userInfo.uniqueName}
              </p>
            )}
          </div>
          <FollowButton userId={userId} userInfo={userInfo} />
        </div>

        {stats ? (
          <div className="grid grid-cols-4 gap-4 mt-6">
            <StatCard label="PRs Created" value={stats.totalCreated} />
            <StatCard label="PRs Reviewed" value={stats.totalReviewed} />
            <StatCard label="Active PRs" value={stats.activeOwn} />
            <StatCard
              label="Median Merge Time"
              value={
                stats.medianDaysToMerge < 1
                  ? `${Math.round(stats.medianDaysToMerge * 24)}h`
                  : `${Math.round(stats.medianDaysToMerge)}d`
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} className="p-3 h-16" />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <p className="text-xs text-zinc-400">
            {getTimeRangeLabel(timeRange)}, up to {fetchLimit.toLocaleString()}{" "}
            PRs
            {((stats?.totalCreated ?? 0) >= fetchLimit ||
              (stats?.totalReviewed ?? 0) >= fetchLimit) && (
              <span className="text-amber-500 ml-1">— limit reached</span>
            )}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-zinc-400 mr-1">Range:</span>
              <select
                value={timeRange}
                onChange={(e) => {
                  setParam({ range: e.target.value, day: null });
                }}
                className="text-[11px] font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ado-blue"
              >
                {TIME_RANGE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-zinc-400 mr-1">Limit:</span>
              {PROFILE_LIMITS.map((n) => (
                <button
                  key={n}
                  onClick={() => setParam({ limit: String(n) })}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    fetchLimit === n
                      ? "bg-ado-blue text-white"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contribution Graph */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          PR Activity
        </h2>
        {contributionData.data ? (
          <ContributionGraph
            data={contributionData.data}
            startDate={new Date(bounds.minTime)}
            endDate={bounds.maxTime ? new Date(bounds.maxTime) : undefined}
            selectedDay={selectedDay}
            onDayClick={(day) => setParam({ day })}
          />
        ) : (
          <SkeletonCard className="h-28" />
        )}
      </div>

      {/* Activity in time range */}
      {prs.data ? (
        <ActivityRange
          created={prs.data.created}
          reviewed={prs.data.reviewed}
          selectedDay={selectedDay}
          activityRange={activityRange}
          setActivityRange={setActivityRange}
          onClearDay={() => setParam({ day: null })}
          userId={userId}
          pageTimeRange={timeRange}
        />
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <SkeletonCard className="p-3 h-16" />
            <SkeletonCard className="p-3 h-16" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} className="h-8" />
            ))}
          </div>
        </div>
      )}

      {/* Top Repos */}
      {topRepos.data && topRepos.data.length > 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Top Repositories
          </h2>
          <div className="space-y-2">
            {topRepos.data.map((repo) => (
              <div
                key={`${repo.project}/${repo.name}`}
                className="flex items-center justify-between py-1.5"
              >
                <div className="text-sm">
                  <span className="font-medium">{repo.name}</span>
                  <span className="text-xs text-zinc-400 ml-2">
                    {repo.project}
                  </span>
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
      ) : prs.isLoading ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <Skeleton className="h-5 w-36 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} className="h-8" />
            ))}
          </div>
        </div>
      ) : null}

      {/* Review Impact */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Review Impact
            {reviewImpact.data?.analyzedFrom &&
              reviewImpact.data?.analyzedTo && (
                <span className="text-[11px] font-normal text-zinc-400 ml-1">
                  {format(
                    new Date(reviewImpact.data.analyzedFrom),
                    "MMM d, yyyy",
                  )}{" "}
                  —{" "}
                  {format(
                    new Date(reviewImpact.data.analyzedTo),
                    "MMM d, yyyy",
                  )}
                  <span className="ml-1">
                    ({reviewImpact.data.totalPrsAnalyzed} PRs)
                  </span>
                </span>
              )}
          </h2>
          <div className="flex items-center gap-2">
            {(reviewImpact.data?.repoBreakdown ?? []).length > 1 && (
              <select
                value={reviewRepoFilter ?? ""}
                onChange={(e) => setReviewRepoFilter(e.target.value || null)}
                className="text-[11px] font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ado-blue"
              >
                <option value="">All repos</option>
                {(reviewImpact.data?.repoBreakdown ?? []).map((r) => (
                  <option key={`${r.project}/${r.name}`} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={reviewAnalysisLimit}
              onChange={(e) => {
                setParam({ rlimit: e.target.value });
                setReviewRepoFilter(null);
              }}
              className="text-[11px] font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ado-blue"
            >
              {[20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  Last {n} PRs
                </option>
              ))}
            </select>
          </div>
        </div>
        {reviewImpact.isLoading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing {reviewAnalysisLimit} review threads...
          </div>
        )}
        {reviewImpact.error && (
          <p className="text-sm text-red-500">
            Failed to load review data: {(reviewImpact.error as Error).message}
          </p>
        )}
        {reviewImpact.data &&
          (() => {
            const data = reviewImpact.data;
            const repoBreakdown = data.repoBreakdown ?? [];
            const filteredRepos = reviewRepoFilter
              ? repoBreakdown.filter((r) => r.name === reviewRepoFilter)
              : repoBreakdown;
            const filteredComments = reviewRepoFilter
              ? filteredRepos.reduce((sum, r) => sum + r.comments, 0)
              : data.totalComments;
            const filteredPrs = reviewRepoFilter
              ? filteredRepos.reduce((sum, r) => sum + r.prsReviewed, 0)
              : data.totalPrsAnalyzed;

            return (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <StatCard label="Comments Left" value={filteredComments} />
                  <StatCard
                    label="Avg Comments Per PR"
                    value={
                      filteredPrs > 0
                        ? (filteredComments / filteredPrs).toFixed(1)
                        : "0"
                    }
                  />
                  <StatCard
                    label="PRs with Comments"
                    value={`${data.prsWithComments} / ${data.totalPrsAnalyzed}`}
                  />
                </div>
                <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3 h-3" />
                    {data.approved} approved
                  </span>
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle2 className="w-3 h-3" />
                    {data.approvedWithSuggestions} w/ suggestions
                  </span>
                  <span className="flex items-center gap-1 text-orange-500">
                    {data.waitingForAuthor} wait for author
                  </span>
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle className="w-3 h-3" />
                    {data.rejected} rejected
                  </span>
                  <span className="text-zinc-400">·</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    {data.completedCount} PR completed
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-500" />
                    {data.abandonedCount} PR abandoned
                  </span>
                </div>
                {filteredRepos.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      By Repository
                    </h3>
                    <div className="space-y-1">
                      {filteredRepos.map((repo) => (
                        <div
                          key={`${repo.project}/${repo.name}`}
                          className="flex items-center justify-between py-1.5 text-sm"
                        >
                          <div>
                            <span className="font-medium">{repo.name}</span>
                            <span className="text-xs text-zinc-400 ml-2">
                              {repo.project}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <span>{repo.prsReviewed} PRs</span>
                            <span>{repo.comments} comments</span>
                            <span className="text-zinc-400">
                              {repo.prsReviewed > 0
                                ? (repo.comments / repo.prsReviewed).toFixed(1)
                                : "0"}
                              /PR
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.reviewHistory && data.reviewHistory.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Review History
                        {data.prsWithVoteChanges > 0 && (
                          <span className="ml-2 text-ado-blue normal-case font-normal">
                            {data.prsWithVoteChanges} PR
                            {data.prsWithVoteChanges > 1 ? "s" : ""} with vote
                            changes
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {data.reviewHistory
                        .slice(0, reviewHistoryVisible)
                        .map((event, i) => {
                          const url = buildPrWebUrl(
                            useSettingsStore.getState().organization,
                            event.project,
                            event.repo,
                            event.prId,
                          );
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between py-1 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {event.type === "vote" ? (
                                  <VoteLabel vote={event.vote} />
                                ) : (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 bg-ado-blue/10 text-ado-blue">
                                    {event.count === 1
                                      ? "commented"
                                      : `${event.count} comments`}
                                  </span>
                                )}
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 min-w-0 hover:text-ado-blue transition-colors"
                                >
                                  <span className="text-zinc-400">
                                    #{event.prId}
                                  </span>
                                  <span className="truncate">
                                    {event.prTitle}
                                  </span>
                                </a>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2 text-zinc-400">
                                <span>{event.repo}</span>
                                <span
                                  title={format(
                                    new Date(event.date),
                                    "MMM d, yyyy h:mm a",
                                  )}
                                >
                                  {formatDistanceToNow(new Date(event.date), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    {data.reviewHistory.length > reviewHistoryVisible && (
                      <button
                        onClick={() => setReviewHistoryVisible((v) => v + 100)}
                        className="mt-2 text-xs text-ado-blue hover:underline"
                      >
                        View more events (
                        {data.reviewHistory.length - reviewHistoryVisible}{" "}
                        remaining)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        {!reviewImpact.isLoading &&
          !reviewImpact.data &&
          !reviewImpact.error && (
            <p className="text-sm text-zinc-400">No review activity found.</p>
          )}
      </div>

      {/* AI Summary */}
      <UserAiSummary
        topRepos={topRepos.data}
        prs={prs.data}
        reviewImpact={reviewImpact.data}
        userName={userName}
        userImageUrl={userInfo?.imageUrl ?? null}
        userId={userId}
        timeRange={timeRange}
        fetchLimit={fetchLimit}
      />

      {/* Recent PRs */}
      {prs.data && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <GitPullRequest className="w-4 h-4" />
            Recent PRs Created ({prs.data.created.length})
          </h2>
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
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
        {label}
      </div>
    </div>
  );
}

type PRItem = {
  pullRequestId: number;
  title: string;
  status: string;
  isDraft: boolean;
  createdBy: {
    id: string;
    displayName: string;
    uniqueName: string;
    imageUrl: string;
  };
  creationDate: string;
  closedDate?: string;
  mergeStatus?: string;
  repository: {
    id: string;
    name: string;
    webUrl: string;
    project: { id: string; name: string };
  };
  sourceRefName: string;
  targetRefName: string;
  reviewers: {
    id: string;
    displayName: string;
    uniqueName: string;
    imageUrl: string;
    vote: number;
    isRequired?: boolean;
  }[];
  labels?: { id: string; name: string; active: boolean }[];
};

const RANGE_OPTIONS: { value: "7d" | "30d" | "90d" | "1y"; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

function getRangeCutoff(range: "7d" | "30d" | "90d" | "1y"): Date {
  const now = new Date();
  switch (range) {
    case "7d":
      return subDays(now, 7);
    case "30d":
      return subDays(now, 30);
    case "90d":
      return subMonths(now, 3);
    case "1y":
      return subDays(now, 365);
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
  pageTimeRange,
}: {
  created: PRItem[];
  reviewed: PRItem[];
  selectedDay: string | null;
  activityRange: "7d" | "30d" | "90d" | "1y";
  setActivityRange: (r: "7d" | "30d" | "90d" | "1y") => void;
  onClearDay: () => void;
  userId: string;
  pageTimeRange: TimeRange;
}) {
  const isDay = selectedDay !== null;
  const showSubRanges =
    pageTimeRange === "last-1y" || pageTimeRange === "last-6m";

  const heading = isDay
    ? `Activity on ${format(new Date(selectedDay + "T00:00:00"), "MMM d, yyyy")}`
    : showSubRanges
      ? `Activity in the past ${RANGE_OPTIONS.find((r) => r.value === activityRange)?.label}`
      : `Activity — ${getTimeRangeLabel(pageTimeRange)}`;

  const mergedActivity = useMemo(() => {
    const filterByTime = (prs: PRItem[]) => {
      if (isDay) {
        const dayStart = startOfDay(new Date(selectedDay + "T00:00:00"));
        const dayEnd = endOfDay(dayStart);
        return prs.filter((pr) => {
          const d = new Date(pr.creationDate);
          return isAfter(d, dayStart) && d <= dayEnd;
        });
      }
      if (showSubRanges) {
        const cutoff = getRangeCutoff(activityRange);
        return prs.filter((pr) => isAfter(new Date(pr.creationDate), cutoff));
      }
      return prs;
    };

    const filteredCreated = filterByTime(created).map((pr) => ({
      pr,
      label: "created" as const,
      sortDate: pr.creationDate,
    }));

    const completedEvents = created
      .filter((pr) => pr.status === "completed" && pr.closedDate)
      .filter((pr) => {
        if (isDay) {
          const dayStart = startOfDay(new Date(selectedDay + "T00:00:00"));
          const dayEnd = endOfDay(dayStart);
          const d = new Date(pr.closedDate!);
          return isAfter(d, dayStart) && d <= dayEnd;
        }
        if (showSubRanges) {
          return isAfter(
            new Date(pr.closedDate!),
            getRangeCutoff(activityRange),
          );
        }
        return true;
      })
      .map((pr) => ({
        pr,
        label: "completed" as const,
        sortDate: pr.closedDate!,
      }));

    const filteredReviewed = filterByTime(reviewed).map((pr) => {
      const vote = pr.reviewers.find((r) => r.id === userId)?.vote ?? 0;
      const label =
        vote >= 10
          ? "approved"
          : vote >= 5
            ? "approved w/ suggestions"
            : vote <= -10
              ? "rejected"
              : "waiting";
      return { pr, label, sortDate: pr.closedDate ?? pr.creationDate };
    });

    return [...filteredCreated, ...completedEvents, ...filteredReviewed].sort(
      (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime(),
    );
  }, [
    created,
    reviewed,
    selectedDay,
    isDay,
    activityRange,
    showSubRanges,
    userId,
  ]);

  const createdCount = mergedActivity.filter(
    (a) => a.label === "created",
  ).length;
  const reviewedCount = mergedActivity.length - createdCount;

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
          {!isDay && showSubRanges && (
            <div className="flex gap-1">
              {RANGE_OPTIONS.filter(
                (r) => !(pageTimeRange === "last-6m" && r.value === "1y"),
              ).map((r) => (
                <button
                  key={r.value}
                  onClick={() => setActivityRange(r.value)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    activityRange === r.value
                      ? "bg-ado-blue text-white"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
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
        <StatCard label="PRs Created" value={createdCount} />
        <StatCard label="PRs Reviewed" value={reviewedCount} />
      </div>

      {mergedActivity.length > 0 && (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {mergedActivity.map((item) => (
            <MiniPrRow
              key={`${item.label}-${item.pr.pullRequestId}`}
              pr={item.pr}
              label={item.label}
              date={item.sortDate}
            />
          ))}
        </div>
      )}

      {mergedActivity.length === 0 && (
        <p className="text-sm text-zinc-400 text-center py-4">
          No activity in this period.
        </p>
      )}
    </div>
  );
}

function MiniPrRow({
  pr,
  label,
  date,
}: {
  pr: PRItem;
  label: string;
  date: string;
}) {
  const org = useSettingsStore((s) => s.organization);
  const webUrl = buildPrWebUrl(
    org,
    pr.repository.project.name,
    pr.repository.name,
    pr.pullRequestId,
  );

  return (
    <a
      href={webUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-3 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
            label === "created"
              ? "bg-ado-blue/10 text-ado-blue"
              : label === "completed"
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : label === "approved" || label === "approved w/ suggestions"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                  : label === "rejected"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
          }`}
        >
          {label}
        </span>
        <span className="text-xs text-zinc-400">#{pr.pullRequestId}</span>
        <span className="text-sm truncate">{pr.title}</span>
      </div>
      <div className="flex items-center gap-2 mt-0.5 ml-[calc(theme(spacing.1.5)*2+theme(spacing.2))] text-[11px] text-zinc-400">
        <span>{pr.repository.name}</span>
        <span>·</span>
        <span>{pr.targetRefName.replace("refs/heads/", "")}</span>
        <span>·</span>
        <span title={format(new Date(date), "MMM d, yyyy h:mm a")}>
          {formatDistanceToNow(new Date(date), { addSuffix: true })}
        </span>
      </div>
    </a>
  );
}

function VoteLabel({ vote }: { vote: number }) {
  const label =
    vote >= 10
      ? "approved"
      : vote >= 5
        ? "approved w/ suggestions"
        : vote <= -10
          ? "rejected"
          : vote <= -5
            ? "waiting"
            : "reset";
  const color =
    vote >= 10
      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
      : vote >= 5
        ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
        : vote <= -10
          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
          : vote <= -5
            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500";
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${color}`}
    >
      {label}
    </span>
  );
}

function FollowButton({
  userId,
  userInfo,
}: {
  userId: string;
  userInfo: {
    displayName: string;
    uniqueName: string;
    imageUrl: string;
  } | null;
}) {
  const currentUserId = useSettingsStore((s) => s.userId);
  const isFollowing = useFollowsStore((s) => s.isFollowing(userId));
  const toggleUser = useFollowsStore((s) => s.toggleUser);

  if (userId === currentUserId) return null;

  return (
    <button
      onClick={() =>
        toggleUser({
          id: userId,
          displayName: userInfo?.displayName ?? userId,
          uniqueName: userInfo?.uniqueName ?? "",
          imageUrl: userInfo?.imageUrl ?? "",
        })
      }
      className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-colors ml-auto ${
        isFollowing
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-500"
          : "bg-ado-blue text-white hover:bg-ado-blue-dark"
      }`}
    >
      {isFollowing ? (
        <>
          <UserMinus className="w-4 h-4" /> Unfollow
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" /> Follow
        </>
      )}
    </button>
  );
}
