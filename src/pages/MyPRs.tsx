import { useState } from 'react';
import { GitPullRequest, RefreshCw, Eye, PenLine } from 'lucide-react';
import { PRCard } from '../components/PRCard';
import { useMyPullRequests } from '../hooks/useAdo';
import { useSelectedProjectsStore } from '../store/selectedProjects';

type StatusFilter = 'active' | 'completed' | 'abandoned' | 'all';
type ViewTab = 'created' | 'reviewing';

export function MyPRs() {
  const [status, setStatus] = useState<StatusFilter>('active');
  const [tab, setTab] = useState<ViewTab>('created');
  const selectedProjects = useSelectedProjectsStore((s) => s.projects);
  const { data, isLoading, error, refetch, isFetching } = useMyPullRequests(status);

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

  const prs = tab === 'created' ? data?.created : data?.reviewing;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitPullRequest className="w-6 h-6" />
          My Pull Requests
        </h1>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-ado-blue transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-1 mb-4 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('created')}
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
          onClick={() => setTab('reviewing')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'reviewing'
              ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Reviewing
          {data?.reviewing && (
            <span className="ml-1 text-xs bg-zinc-200 dark:bg-zinc-600 px-1.5 py-0.5 rounded-full">
              {data.reviewing.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['active', 'completed', 'abandoned', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
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
          <p className="text-sm">No {status === 'all' ? '' : status} pull requests found.</p>
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
