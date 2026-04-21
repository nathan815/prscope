export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse ${className}`} />
  );
}

export function SkeletonCard({ className = '', children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`bg-zinc-50 dark:bg-zinc-800/50 rounded-lg animate-pulse ${className}`}>
      {children}
    </div>
  );
}
