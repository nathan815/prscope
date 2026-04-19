import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Star, Search, Loader2, FolderOpen, X, Check } from 'lucide-react';
import { useProjects, useMultiProjectRepositories } from '../hooks/useAdo';
import { useFavoritesStore } from '../store/favorites';
import { useSelectedProjectsStore } from '../store/selectedProjects';

const ROW_HEIGHT = 40;

export function Repos() {
  const [search, setSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const favorites = useFavoritesStore((s) => s.repos);
  const toggleRepo = useFavoritesStore((s) => s.toggleRepo);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);

  const selectedProjects = useSelectedProjectsStore((s) => s.projects);
  const toggleProject = useSelectedProjectsStore((s) => s.toggleProject);
  const isProjectSelected = useSelectedProjectsStore((s) => s.isSelected);
  const removeProject = useSelectedProjectsStore((s) => s.removeProject);

  const { data: allProjects, isLoading: loadingProjects } = useProjects();
  const { data: repos, isLoading: loadingRepos } = useMultiProjectRepositories(
    selectedProjects.map((p) => p.name)
  );

  const filteredProjects = useMemo(
    () => allProjects?.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase())),
    [allProjects, projectSearch]
  );

  const filteredRepos = useMemo(
    () => repos?.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [repos, search]
  );

  const filteredFavorites = useMemo(
    () => favorites.filter((r) => r.repoName.toLowerCase().includes(search.toLowerCase())),
    [favorites, search]
  );

  const repoListRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredRepos?.length ?? 0,
    getScrollElement: () => repoListRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Star className="w-6 h-6" />
        Repositories
      </h1>

      {/* Project selection */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Projects</label>
          <button
            onClick={() => setShowProjectPicker(!showProjectPicker)}
            className="text-xs text-ado-blue hover:underline"
          >
            {showProjectPicker ? 'Done' : 'Edit projects'}
          </button>
        </div>

        {selectedProjects.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedProjects.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 bg-ado-blue/10 text-ado-blue pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium"
              >
                <FolderOpen className="w-3 h-3" />
                {p.name}
                <button
                  onClick={() => removeProject(p.id)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-ado-blue/20 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {selectedProjects.length === 0 && !showProjectPicker && (
          <button
            onClick={() => setShowProjectPicker(true)}
            className="w-full py-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-sm text-zinc-500 dark:text-zinc-400 hover:border-ado-blue hover:text-ado-blue transition-colors"
          >
            Select projects to browse repositories
          </button>
        )}

        {showProjectPicker && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ado-blue/40"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loadingProjects && (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading projects...
                </div>
              )}
              {filteredProjects?.map((project) => {
                const selected = isProjectSelected(project.id);
                return (
                  <button
                    key={project.id}
                    onClick={() => toggleProject({ id: project.id, name: project.name })}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
                      selected ? 'bg-ado-blue/5' : ''
                    }`}
                  >
                    <span className={selected ? 'font-medium text-ado-blue' : ''}>{project.name}</span>
                    {selected && <Check className="w-4 h-4 text-ado-blue" />}
                  </button>
                );
              })}
              {filteredProjects?.length === 0 && (
                <p className="px-4 py-3 text-sm text-zinc-400">No projects match.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Search repos */}
      {selectedProjects.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder={`Search${repos ? ` ${repos.length.toLocaleString()}` : ''} repositories...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ado-blue/40 focus:border-ado-blue"
          />
        </div>
      )}

      {/* Favorited repos */}
      {filteredFavorites.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Favorited ({filteredFavorites.length})
          </h2>
          <div className="grid gap-1">
            {filteredFavorites.map((repo) => (
              <RepoRow
                key={repo.repoId}
                repoName={repo.repoName}
                projectName={repo.projectName}
                isFavorite={true}
                onToggle={() => toggleRepo(repo)}
              />
            ))}
          </div>
        </section>
      )}

      {/* All repos from selected projects — virtualized */}
      {selectedProjects.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            {search ? 'Results' : 'All Repositories'}
            {filteredRepos && ` (${filteredRepos.length.toLocaleString()})`}
          </h2>

          {loadingRepos && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading repositories...
            </div>
          )}

          {filteredRepos && filteredRepos.length === 0 && !loadingRepos && (
            <p className="text-sm text-zinc-400 py-4">No repositories found.</p>
          )}

          {filteredRepos && filteredRepos.length > 0 && (
            <div
              ref={repoListRef}
              className="overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              style={{ height: Math.min(filteredRepos.length * ROW_HEIGHT, 600) }}
            >
              <div
                style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const repo = filteredRepos[virtualRow.index]!;
                  return (
                    <div
                      key={repo.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: ROW_HEIGHT,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <RepoRow
                        repoName={repo.name}
                        projectName={repo.project.name}
                        isFavorite={isFavorite(repo.id)}
                        onToggle={() =>
                          toggleRepo({
                            repoId: repo.id,
                            repoName: repo.name,
                            projectId: repo.project.id,
                            projectName: repo.project.name,
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
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
  repoName: string;
  projectName: string;
  isFavorite: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <div className="min-w-0 truncate">
        <span className="text-sm font-medium">{repoName}</span>
        <span className="text-xs text-zinc-400 ml-2">{projectName}</span>
      </div>
      <button
        onClick={onToggle}
        className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
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
