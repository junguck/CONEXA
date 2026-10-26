import { cn } from './cn';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'square';
  className?: string;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** Avatar : photo si fournie, sinon initiales. Toujours un texte alternatif utile. */
export function Avatar({ name, src, size = 'md', shape = 'circle', className }: AvatarProps) {
  const dimension =
    size === 'sm' ? 'h-9 w-9 text-xs' : size === 'lg' ? 'h-16 w-16 text-lg' : 'h-11 w-11 text-sm';

  return (
    <span
      className={cn(
        'inline-flex flex-none items-center justify-center overflow-hidden bg-surface2 font-display font-bold text-accent-text',
        shape === 'circle' ? 'rounded-full' : 'rounded-token',
        dimension,
        className,
      )}
      aria-label={name}
      role="img"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
