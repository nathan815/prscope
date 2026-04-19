import { Circle, CheckCircle2, XCircle, FileEdit } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  active: { label: 'Active', color: 'text-status-active bg-status-active/10', icon: Circle },
  completed: { label: 'Completed', color: 'text-status-completed bg-status-completed/10', icon: CheckCircle2 },
  abandoned: { label: 'Abandoned', color: 'text-status-abandoned bg-status-abandoned/10', icon: XCircle },
};

export function StatusBadge({ status, isDraft }: { status: string; isDraft?: boolean }) {
  if (isDraft) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full text-status-draft bg-status-draft/10">
        <FileEdit className="w-3 h-3" />
        Draft
      </span>
    );
  }

  const config = statusConfig[status] ?? statusConfig['active']!;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
