import { useState } from 'react';
import { Rss, Search, UserPlus, X, RefreshCw, Loader2, GitPullRequest, CheckCircle2, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useFollowsStore } from '../store/follows';
import { useSelectedProjectsStore } from '../store/selectedProjects';
import { useFollowedUserActivity } from '../hooks/useAdo';
import { searchIdentities, buildPrWebUrl } from '../api/client';
import { useSettingsStore } from '../store/settings';

export function Feed() {
  const follows = useFollowsStore((s) => s.users);
  const removeUser = useFollowsStore((s) => s.removeUser);
  const addUser = useFollowsStore((s) => s.addUser);
  const selectedProjects = useSelectedProjectsStore((s) => s.projects);
  const org = useSettingsStore((s) => s.organization);
  const { data: activity, isLoading, refetch, isFetching } = useFollowedUserActivity();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; displayName: string; uniqueName: string; imageUrl: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await searchIdentities(searchQuery);
      setSearchResults(results.slice(0, 10));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  if (selectedProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Rss className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Select projects first</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
          The feed shows activity from followed people across your selected projects. Select projects in the Repos tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Rss className="w-6 h-6" />
          Activity Feed
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-1.5 text-sm bg-ado-blue text-white px-3 py-1.5 rounded-lg hover:bg-ado-blue-dark transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Follow People
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-ado-blue transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-6">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ado-blue/40"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-ado-blue text-white rounded-lg text-sm hover:bg-ado-blue-dark transition-colors disabled:opacity-50"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((user) => {
                const isFollowing = follows.some((f) => f.id === user.id);
                return (
                  <div key={user.id} className="flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <img src={user.imageUrl} alt="" className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <span className="text-sm">{user.displayName}</span>
                      <span className="text-xs text-zinc-400">{user.uniqueName}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (isFollowing) {
                          removeUser(user.id);
                        } else {
                          addUser({ id: user.id, displayName: user.displayName, uniqueName: user.uniqueName, imageUrl: user.imageUrl });
                        }
                      }}
                      className={`text-xs px-2 py-1 rounded-md transition-colors ${
                        isFollowing
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                          : 'bg-ado-blue text-white hover:bg-ado-blue-dark'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {follows.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {follows.map((user) => (
            <span key={user.id} className="inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 pl-1.5 pr-2 py-1 rounded-full text-xs">
              <img src={user.imageUrl} alt="" className="w-4 h-4 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {user.displayName}
              <button onClick={() => removeUser(user.id)} className="ml-1 text-zinc-400 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {follows.length === 0 && (
        <div className="text-center py-16 text-zinc-500 dark:text-zinc-400">
          <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Follow people to see their PR activity here.</p>
        </div>
      )}

      {isLoading && follows.length > 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {activity && activity.length > 0 && (
        <div className="space-y-3">
          {activity.map((item) => (
            <ActivityCard key={item.id} item={item} org={org} />
          ))}
        </div>
      )}

      {activity && activity.length === 0 && follows.length > 0 && (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          <p className="text-sm">No recent activity found from followed people.</p>
        </div>
      )}
    </div>
  );
}

const activityIcons = {
  pr_created: GitPullRequest,
  pr_completed: CheckCircle2,
  pr_reviewed: Eye,
  pr_commented: Rss,
};

const activityLabels = {
  pr_created: 'created',
  pr_completed: 'completed',
  pr_reviewed: 'is reviewing',
  pr_commented: 'commented on',
};

function ActivityCard({ item, org }: {
  item: {
    type: 'pr_created' | 'pr_completed' | 'pr_reviewed' | 'pr_commented';
    user: { displayName: string; imageUrl: string };
    pullRequest: { pullRequestId: number; title: string; status: string; repository: { name: string; project: { name: string } }; sourceRefName: string; targetRefName: string };
    timestamp: string;
  };
  org: string;
}) {
  const Icon = activityIcons[item.type];
  const label = activityLabels[item.type];
  const webUrl = buildPrWebUrl(org, item.pullRequest.repository.project.name, item.pullRequest.repository.name, item.pullRequest.pullRequestId);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <img src={item.user.imageUrl} alt="" className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-medium">{item.user.displayName}</span>{' '}
            <span className="text-zinc-500 dark:text-zinc-400">{label}</span>{' '}
            <a href={webUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ado-blue hover:underline">
              {item.pullRequest.title}
            </a>
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
            <Icon className="w-3 h-3" />
            <span>{item.pullRequest.repository.project.name}/{item.pullRequest.repository.name}</span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
