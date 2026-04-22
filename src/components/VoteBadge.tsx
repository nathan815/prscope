import { Check, X, Clock, Minus } from "lucide-react";

function getVoteInfo(vote: number) {
  switch (vote) {
    case 10:
      return {
        label: "Approved",
        icon: Check,
        iconColor: "text-white dark:text-green-950",
        bg: "bg-green-600 dark:bg-green-500",
      };
    case 5:
      return {
        label: "Approved with suggestions",
        icon: Check,
        iconColor: "text-white dark:text-green-950",
        bg: "bg-green-500 dark:bg-green-400",
      };
    case -5:
      return {
        label: "Waiting for author",
        icon: Clock,
        iconColor: "text-white",
        bg: "bg-orange-500",
      };
    case -10:
      return {
        label: "Rejected",
        icon: X,
        iconColor: "text-white",
        bg: "bg-red-600",
      };
    default:
      return {
        label: "No response",
        icon: Minus,
        iconColor: "text-zinc-500",
        bg: "bg-zinc-200 dark:bg-zinc-700",
      };
  }
}

export function sortReviewers<T extends { vote: number }>(reviewers: T[]): T[] {
  return [...reviewers].sort((a, b) => {
    const aResponded = a.vote !== 0 ? 1 : 0;
    const bResponded = b.vote !== 0 ? 1 : 0;
    if (aResponded !== bResponded) return bResponded - aResponded;
    return Math.abs(b.vote) - Math.abs(a.vote);
  });
}

export function VoteBadge({
  reviewer,
}: {
  reviewer: { displayName: string; imageUrl: string; vote: number; isRequired?: boolean };
}) {
  const info = getVoteInfo(reviewer.vote);
  const Icon = info.icon;

  return (
    <div className="relative" title={`${reviewer.displayName}: ${info.label}`}>
      <img
        src={reviewer.imageUrl}
        alt={reviewer.displayName}
        className="w-6 h-6 rounded-full border border-zinc-200 dark:border-zinc-700"
        onError={(e) => {
          const el = e.target as HTMLImageElement;
          el.style.display = "none";
          const fallback = document.createElement("div");
          fallback.className =
            "w-6 h-6 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-medium text-zinc-600 dark:text-zinc-300";
          fallback.textContent = reviewer.displayName.charAt(0);
          el.parentElement!.insertBefore(fallback, el);
        }}
      />
      <span
        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center ${info.bg} border border-white dark:border-zinc-900`}
      >
        <Icon className={`w-2 h-2 ${info.iconColor}`} strokeWidth={3} />
      </span>
    </div>
  );
}
