import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from './cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

/** État vide : explique ce qui manque et propose la prochaine action. */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-panel border border-dashed border-line bg-surface px-6 py-10 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface2 text-muted">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-base font-bold text-ink">{title}</h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
