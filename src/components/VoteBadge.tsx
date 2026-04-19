const voteConfig: Record<number, { label: string; color: string; ring: string }> = {
  10: { label: 'Approved', color: 'border-vote-approved', ring: 'ring-vote-approved/30' },
  5: { label: 'Approved with suggestions', color: 'border-vote-approved-suggestions', ring: 'ring-vote-approved-suggestions/30' },
  0: { label: 'No response', color: 'border-zinc-300 dark:border-zinc-600', ring: '' },
  '-5': { label: 'Waiting', color: 'border-vote-waiting', ring: 'ring-vote-waiting/30' },
  '-10': { label: 'Rejected', color: 'border-vote-rejected', ring: 'ring-vote-rejected/30' },
};

function getVoteConfig(vote: number) {
  return voteConfig[vote] ?? voteConfig[0]!;
}

export function VoteBadge({ reviewer }: {
  reviewer: { displayName: string; imageUrl: string; vote: number; isRequired?: boolean };
}) {
  const config = getVoteConfig(reviewer.vote);

  return (
    <div className="relative group/vote" title={`${reviewer.displayName}: ${config.label}`}>
      <img
        src={reviewer.imageUrl}
        alt={reviewer.displayName}
        className={`w-6 h-6 rounded-full border-2 ${config.color} ${config.ring ? `ring-2 ${config.ring}` : ''}`}
        onError={(e) => {
          const el = e.target as HTMLImageElement;
          el.style.display = 'none';
          el.parentElement!.innerHTML = `<div class="w-6 h-6 rounded-full border-2 ${config.color} bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-medium text-zinc-600 dark:text-zinc-300">${reviewer.displayName.charAt(0)}</div>`;
        }}
      />
      {reviewer.isRequired && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400 border border-white dark:border-zinc-900" />
      )}
    </div>
  );
}
