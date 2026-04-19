import { useState, useMemo, useRef, useEffect } from 'react';
import { GitPullRequest, RefreshCw, PenLine, X, SlidersHorizontal, Calendar, Eye, UserCheck } from 'lucide-react';
import { subDays, subMonths, subYears, startOfDay } from 'date-fns';
import { PRCard } from '../components/PRCard';
import { useMyPullRequests } from '../hooks/useAdo';
import { useSelectedProjectsStore } from '../store/selectedProjects';
import { useSettingsStore } from '../store/settings';
import { useReviewingStore, prKey } from '../store/reviewing';

type StatusFilter = 'active' | 'completed' | 'abandoned' | 'all';
type ViewTab = 'created' | 'assigned' | 'reviewing';
type TimeFilter = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
  { value: 'all', label: 'All time' },
];

function getTimeCutoff(filter: TimeFilter): string | undefined {
  const now = startOfDay(new Date());
  switch (filter) {
    case '7d': return subDays(now, 7).toISOString();
    case '30d': return subDays(now, 30).toISOString();
    case '90d': return subDays(now, 90).toISOString();
    case '6m': return subMonths(now, 6).toISOString();
    case '1y': return subYears(now, 1).toISOString();
    case 'all': return undefined;
  }
}

const LIMIT_OPTIONS = [500, 1000, 2000, 5000];

function LimitPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const maxPRs = useSettingsStore((s) => s.maxPRs);
  const setMaxPRs = useSettingsStore((s) => s.setMaxPRs);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-ado-blue transition-colors"
      >
        <SlidersHorizontal className="w-3 h-3" />
        Last {maxPRs.toLocaleString()} PRs
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg p-2 min-w-[140px]">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold px-2 mb-1">Fetch limit</p>
          {LIMIT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => { setMaxPRs(n); setOpen(false); }}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                maxPRs === n
                  ? 'bg-ado-blue/10 text-ado-blue font-medium'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {n.toLocaleString()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MyPRs() {
  const [status, setStatus] = useState<StatusFilter>('active');
  const [tab, setTab] = useState<ViewTab>('created');
  const [repoFilter, setRepoFilter] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  const selectedProjects = useSelectedProjectsStore((s) => s.projects);
  const minTime = useMemo(() => getTimeCutoff(timeFilter), [timeFilter]);
  const { data, isLoading, error, refetch, isFetching } = useMyPullRequests(status, minTime);
  const reviewingPrIds = useReviewingStore((s) => s.prIds);

  if (selectedProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <GitPullRequest className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-4" />
        <h2 className="text-lg font-semibold mb-2">No projects selected</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
          Head to the <strong>Repos</strong> tab and select your projects to start seeing PRs here.
        </p>
      </div>
    );
  }

  const allAssigned = data?.assigned;
  const allCreated = data?.created;

  const allFetchedPrs = useMemo(() => {
    const prs = [...(allCreated ?? []), ...(allAssigned ?? [])];
    const seen = new Set<number>();
    return prs.filter((pr) => {
      if (seen.has(pr.pullRequestId)) return false;
      seen.add(pr.pullRequestId);
      return true;
    });
  }, [allCreated, allAssigned]);

  const reviewingPrs = useMemo(() => {
    return allFetchedPrs.filter((pr) =>
      reviewingPrIds.has(prKey(pr.repository.project.name, pr.repository.name, pr.pullRequestId))
    );
  }, [allFetchedPrs, reviewingPrIds]);

  const allPrs = tab === 'created' ? allCreated : tab === 'assigned' ? allAssigned : reviewingPrs;

  const repoCounts = useMemo(() => {
    if (!allPrs) return [];
    const counts = new Map<string, number>();
    for (const pr of allPrs) {
      const name = pr.repository.name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [allPrs]);

  const prs = useMemo(
    () => repoFilter ? allPrs?.filter((pr) => pr.repository.name === repoFilter) : allPrs,
    [allPrs, repoFilter]
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitPullRequest className="w-6 h-6" />
          My Pull Requests
        </h1>
        <div className="flex items-center gap-4">
          <LimitPopover />
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-ado-blue transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => { setTab('created'); setRepoFilter(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'created'
              ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <PenLine className="w-3.5 h-3.5" />
          Created by me
          {data?.created && (
            <span className="ml-1 text-xs bg-zinc-200 dark:bg-zinc-600 px-1.5 py-0.5 rounded-full">
              {data.created.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('assigned'); setRepoFilter(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'assigned'
              ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Assigned
          {data?.assigned && (
            <span className="ml-1 text-xs bg-zinc-200 dark:bg-zinc-600 px-1.5 py-0.5 rounded-full">
              {data.assigned.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('reviewing'); setRepoFilter(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'reviewing'
              ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Reviewing
          {reviewingPrs.length > 0 && (
            <span className="ml-1 text-xs bg-zinc-200 dark:bg-zinc-600 px-1.5 py-0.5 rounded-full">
              {reviewingPrs.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex gap-2">
          {(['active', 'completed', 'abandoned', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setRepoFilter(null); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                status === s
                  ? 'bg-ado-blue text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          <div className="flex gap-1">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTimeFilter(t.value)}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  timeFilter === t.value
                    ? 'bg-zinc-700 dark:bg-zinc-300 text-white dark:text-zinc-900'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Repo summary bar */}
      {repoCounts.length > 0 && (
        <div className="mb-6">
          {repoFilter && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Filtered to:</span>
              <button
                onClick={() => setRepoFilter(null)}
                className="inline-flex items-center gap-1 text-xs font-medium bg-ado-blue/10 text-ado-blue pl-2 pr-1.5 py-0.5 rounded-full hover:bg-ado-blue/20 transition-colors"
              >
                {repoFilter}
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {repoCounts.map(([repo, count]) => (
              <button
                key={repo}
                onClick={() => setRepoFilter(repoFilter === repo ? null : repo)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  repoFilter === repo
                    ? 'bg-ado-blue text-white'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-ado-blue/50'
                }`}
              >
                {repo}
                <span className={`font-semibold ${repoFilter === repo ? 'text-white/80' : 'text-zinc-400'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700 dark:text-red-400">{(error as Error).message}</p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {prs && prs.length === 0 && !isLoading && (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          <p className="text-sm">
            No {status === 'all' ? '' : status} pull requests found
            {repoFilter ? ` in ${repoFilter}` : ''}
            {timeFilter !== 'all' ? ` in the last ${TIME_OPTIONS.find((t) => t.value === timeFilter)?.label}` : ''}.
          </p>
        </div>
      )}

      {prs && prs.length > 0 && (
        <div className="space-y-3">
          {prs.map((pr) => (
            <PRCard key={`${pr.repository.name}-${pr.pullRequestId}`} pr={pr} />
          ))}
        </div>
      )}
    </div>
  );
}
