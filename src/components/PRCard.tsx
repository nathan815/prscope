import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, GitMerge, Clock } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { VoteBadge } from './VoteBadge';
import { useSettingsStore } from '../store/settings';
import { buildPrWebUrl } from '../api/client';

interface PRCardProps {
  pr: {
    pullRequestId: number;
    title: string;
    status: string;
    isDraft: boolean;
    createdBy: { displayName: string; imageUrl: string };
    creationDate: string;
    closedDate?: string;
    repository: { name: string; project: { name: string } };
    sourceRefName: string;
    targetRefName: string;
    reviewers: { id: string; displayName: string; imageUrl: string; vote: number; isRequired?: boolean }[];
    labels?: { name: string; active: boolean }[];
  };
}

function branchName(ref: string) {
  return ref.replace('refs/heads/', '');
}

export function PRCard({ pr }: PRCardProps) {
  const org = useSettingsStore((s) => s.organization);
  const webUrl = buildPrWebUrl(org, pr.repository.project.name, pr.repository.name, pr.pullRequestId);

  return (
    <a
      href={webUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:border-ado-blue/50 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={pr.status} isDraft={pr.isDraft} />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {pr.repository.project.name} / {pr.repository.name}
            </span>
          </div>
          <h3 className="font-semibold text-sm leading-snug mb-2 group-hover:text-ado-blue transition-colors truncate">
            {pr.title}
          </h3>
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <GitMerge className="w-3 h-3" />
              {branchName(pr.sourceRefName)} → {branchName(pr.targetRefName)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(pr.creationDate), { addSuffix: true })}
            </span>
          </div>
        </div>
        <ExternalLink className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <img
            src={pr.createdBy.imageUrl}
            alt={pr.createdBy.displayName}
            className="w-5 h-5 rounded-full"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">{pr.createdBy.displayName}</span>
        </div>

        <div className="flex items-center gap-1">
          {pr.reviewers.slice(0, 5).map((r) => (
            <VoteBadge key={r.id} reviewer={r} />
          ))}
          {pr.reviewers.length > 5 && (
            <span className="text-xs text-zinc-400 ml-1">+{pr.reviewers.length - 5}</span>
          )}
        </div>
      </div>

      {pr.labels && pr.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {pr.labels.filter((l) => l.active).map((l) => (
            <span key={l.name} className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400">
              {l.name}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}
