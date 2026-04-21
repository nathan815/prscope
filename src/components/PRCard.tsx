import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, GitMerge, Clock, Eye, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { VoteBadge, sortReviewers } from './VoteBadge';
import { useSettingsStore } from '../store/settings';
import { useReviewingStore, prKey } from '../store/reviewing';
import { buildPrWebUrl } from '../api/client';
import { toast } from './Toast';

interface PRCardProps {
  pr: {
    pullRequestId: number;
    title: string;
    status: string;
    isDraft: boolean;
    createdBy: { id: string; displayName: string; imageUrl: string };
    creationDate: string;
    closedDate?: string;
    mergeStatus?: string;
    repository: { name: string; project: { name: string } };
    sourceRefName: string;
    targetRefName: string;
    reviewers: { id: string; displayName: string; imageUrl: string; vote: number; isRequired?: boolean }[];
    labels?: { name: string; active: boolean }[];
  };
  showReviewToggle?: boolean;
}

function branchName(ref: string) {
  return ref.replace('refs/heads/', '');
}

export function PRCard({ pr, showReviewToggle = true }: PRCardProps) {
  const org = useSettingsStore((s) => s.organization);
  const userId = useSettingsStore((s) => s.userId);
  const webUrl = buildPrWebUrl(org, pr.repository.project.name, pr.repository.name, pr.pullRequestId);
  const key = prKey(pr.repository.project.name, pr.repository.name, pr.pullRequestId);
  const isReviewing = useReviewingStore((s) => s.isReviewing(key));
  const toggle = useReviewingStore((s) => s.toggle);
  const add = useReviewingStore((s) => s.add);
  const isMyPr = pr.createdBy.id === userId;

  const handleClick = () => {
    if (!isReviewing && !isMyPr) {
      add(key);
      toast(`Marked PR #${pr.pullRequestId} as Reviewing`);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(key);
    if (isReviewing) {
      toast(`Unmarked PR #${pr.pullRequestId} from Reviewing`);
    } else {
      toast(`Marked PR #${pr.pullRequestId} as Reviewing`);
    }
  };

  return (
    <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:border-ado-blue/50 hover:shadow-md transition-all group">
      <a
        href={webUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        onClick={handleClick}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={pr.status} isDraft={pr.isDraft} />
              {pr.mergeStatus === 'conflicts' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="w-3 h-3" />
                  Conflicts
                </span>
              )}
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
                created {formatDistanceToNow(new Date(pr.creationDate), { addSuffix: true })}
              </span>
              {pr.closedDate && (
                <span className="text-green-600">
                  completed {formatDistanceToNow(new Date(pr.closedDate), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <Link
            to={`/profile/${pr.createdBy.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 hover:text-ado-blue transition-colors"
          >
            <img
              src={pr.createdBy.imageUrl}
              alt={pr.createdBy.displayName}
              className="w-5 h-5 rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-ado-blue">{pr.createdBy.displayName}</span>
          </Link>

          <div className="flex items-center gap-1.5">
            {sortReviewers(pr.reviewers).slice(0, 5).map((r) => (
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

      {showReviewToggle && (
        <button
          onClick={handleToggle}
          title={isReviewing ? 'Remove from Reviewing' : 'Mark as Reviewing'}
          className={`absolute top-3 right-10 p-1.5 rounded-lg transition-all ${
            isReviewing
              ? 'bg-ado-blue/10 text-ado-blue'
              : 'text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-ado-blue hover:bg-ado-blue/5'
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
