import { Button } from '@conexa/ui';
import { Heart } from 'lucide-react';
import Link from 'next/link';

export default function MeetMatchPage() {
  return (
    <div className="flex min-h-[75dvh] flex-col items-center justify-center gap-5 py-10 text-center">
      <span
        className="flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg"
        style={{ background: 'var(--grad)' }}
      >
        <Heart className="h-9 w-9" aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[.16em] text-accent-text">
          C’est un match
        </p>
        <h1 className="font-display text-4xl font-bold leading-tight">Mireille a dit oui</h1>
        <p className="max-w-xs text-sm text-muted">
          Choisissez un restaurant partenaire, puis le créneau qui vous convient. Le contact n’est
          révélé qu’après votre « oui » mutuel.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button asChild block>
          <Link href="/meet/lieu">Choisir un restaurant</Link>
        </Button>
        <Button asChild block variant="outline">
          <Link href="/meet/dates">Voir mes dates</Link>
        </Button>
      </div>
    </div>
  );
}
