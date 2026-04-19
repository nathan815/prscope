import { useState, useMemo } from 'react';
import { Star, Search, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useProjects, useRepositories } from '../hooks/useAdo';
import { useFavoritesStore } from '../store/favorites';
import type { FavoriteRepo } from '../types';

export function Repos() {
  const [search, setSearch] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const favorites = useFavoritesStore((s) => s.repos);
  const toggleRepo = useFavoritesStore((s) => s.toggleRepo);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const { data: projects, isLoading: loadingProjects, error: projectsError } = useProjects();

  const toggleProject = (name: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const filteredFavorites = useMemo(
    () => favorites.filter((r) => r.repoName.toLowerCase().includes(search.toLowerCase())),
    [favorites, search]
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Star className="w-6 h-6" />
        Repositories
      </h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ado-blue/40 focus:border-ado-blue"
        />
      </div>

      {filteredFavorites.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Favorited ({filteredFavorites.length})
          </h2>
          <div className="grid gap-2">
            {filteredFavorites.map((repo) => (
              <RepoRow
                key={repo.repoId}
                repoId={repo.repoId}
                repoName={repo.repoName}
                projectName={repo.projectName}
                isFavorite={true}
                onToggle={() => toggleRepo(repo)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
          All Projects
        </h2>

        {projectsError && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-700 dark:text-red-400">{(projectsError as Error).message}</p>
          </div>
        )}

        {loadingProjects && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading projects...
          </div>
        )}

        {projects && (
          <div className="space-y-1">
            {projects.map((project) => (
              <ProjectSection
                key={project.id}
                projectName={project.name}
                isExpanded={expandedProjects.has(project.name)}
                onToggle={() => toggleProject(project.name)}
                search={search}
                isFavorite={isFavorite}
                onToggleRepo={toggleRepo}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectSection({
  projectName,
  isExpanded,
  onToggle,
  search,
  isFavorite,
  onToggleRepo,
}: {
  projectName: string;
  isExpanded: boolean;
  onToggle: () => void;
  search: string;
  isFavorite: (repoId: string) => boolean;
  onToggleRepo: (repo: FavoriteRepo) => void;
}) {
  const { data: repos, isLoading } = useRepositories(isExpanded ? projectName : '');

  const filteredRepos = useMemo(
    () => repos?.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [repos, search]
  );

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {projectName}
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading repos...
            </div>
          )}
          {filteredRepos && filteredRepos.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-400">No repos found.</p>
          )}
          {filteredRepos?.map((repo) => (
            <RepoRow
              key={repo.id}
              repoId={repo.id}
              repoName={repo.name}
              projectName={projectName}
              isFavorite={isFavorite(repo.id)}
              onToggle={() =>
                onToggleRepo({
                  repoId: repo.id,
                  repoName: repo.name,
                  projectId: repo.project.id,
                  projectName: projectName,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RepoRow({
  repoName,
  projectName,
  isFavorite,
  onToggle,
}: {
  repoId: string;
  repoName: string;
  projectName: string;
  isFavorite: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <div>
        <span className="text-sm font-medium">{repoName}</span>
        <span className="text-xs text-zinc-400 ml-2">{projectName}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star
          className={`w-4 h-4 ${
            isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-400 hover:text-yellow-400'
          }`}
        />
      </button>
    </div>
  );
}
