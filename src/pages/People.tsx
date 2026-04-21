import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Loader2, UserPlus, UserMinus } from 'lucide-react';
import { searchIdentities } from '../api/client';
import { useFollowsStore } from '../store/follows';
import { usePageTitle } from '../hooks/usePageTitle';

export function People() {
  usePageTitle('People');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; displayName: string; uniqueName: string; imageUrl: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const follows = useFollowsStore((s) => s.users);
  const isFollowing = useFollowsStore((s) => s.isFollowing);
  const toggleUser = useFollowsStore((s) => s.toggleUser);

  const handleSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const r = await searchIdentities(query);
      setResults(r.slice(0, 20));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
      setHasSearched(true);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Users className="w-6 h-6" />
        People
      </h1>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name or alias..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ado-blue/40"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || query.trim().length < 2}
          className="px-4 py-2.5 bg-ado-blue text-white rounded-lg text-sm font-medium hover:bg-ado-blue-dark transition-colors disabled:opacity-50"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Results ({results.length})
          </h2>
          <div className="space-y-1">
            {results.map((user) => (
              <PersonRow key={user.id} user={user} isFollowing={isFollowing(user.id)} onToggleFollow={() => toggleUser(user)} />
            ))}
          </div>
        </section>
      )}

      {hasSearched && results.length === 0 && !searching && (
        <p className="text-sm text-zinc-400 text-center py-8">No people found.</p>
      )}

      {follows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Following ({follows.length})
          </h2>
          <div className="space-y-1">
            {follows.map((user) => (
              <PersonRow key={user.id} user={user} isFollowing={true} onToggleFollow={() => toggleUser(user)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PersonRow({ user, isFollowing, onToggleFollow }: {
  user: { id: string; displayName: string; uniqueName: string; imageUrl: string };
  isFollowing: boolean;
  onToggleFollow: () => void;
}) {
  const alias = user.uniqueName?.replace(/@.*$/, '') ?? '';

  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-white dark:hover:bg-zinc-900 transition-colors">
      <Link to={`/profile/${user.id}`} className="flex items-center gap-3 min-w-0 flex-1 hover:text-ado-blue transition-colors">
        {user.imageUrl ? (
          <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
            {user.displayName.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <span className="text-sm font-medium block truncate">{user.displayName}</span>
          {alias && <span className="text-xs text-zinc-400 block truncate">{alias}</span>}
        </div>
      </Link>
      <button
        onClick={onToggleFollow}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
          isFollowing
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-500'
            : 'bg-ado-blue text-white hover:bg-ado-blue-dark'
        }`}
      >
        {isFollowing ? <><UserMinus className="w-3 h-3" /> Unfollow</> : <><UserPlus className="w-3 h-3" /> Follow</>}
      </button>
    </div>
  );
}
