import { cn } from './cn';

export interface SkeletonProps {
  className?: string;
  /** Annoncé aux lecteurs d'écran, par défaut « Chargement ». */
  label?: string;
}

/** Bloc de chargement : masqué aux lecteurs d'écran, remplacé par un texte lisible. */
export function Skeleton({ className, label = 'Chargement' }: SkeletonProps) {
  return (
    <span role="status" className="inline-block w-full">
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className={cn('block h-4 w-full animate-pulse rounded-token bg-surface2', className)}
      />
    </span>
  );
}
