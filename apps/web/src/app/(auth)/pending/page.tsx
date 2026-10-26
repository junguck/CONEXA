import { Badge } from '@conexa/ui';
import { Clock } from 'lucide-react';
import Link from 'next/link';

export default function PendingPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface2 text-accent-text">
        <Clock className="h-8 w-8" aria-hidden />
      </span>
      <Badge tone="accent">Validation en cours</Badge>
      <h1 className="font-display text-3xl font-bold leading-tight">
        Ton compte attend un administrateur
      </h1>
      <p className="max-w-xs text-sm text-muted">
        Vérification du matricule en cours. Tu recevras une notification dès que ton compte est
        validé. Les rencontres et les paiements restent bloqués jusque-là.
      </p>
      <Link href="/" className="mt-2 min-h-11 px-3 py-2.5 text-sm font-semibold text-accent-text">
        Revenir à l’accueil
      </Link>
    </div>
  );
}
