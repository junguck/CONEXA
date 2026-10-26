import { Button, Input } from '@conexa/ui';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-8">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[.16em] text-accent-text">Convexa</p>
        <h1 className="font-display text-4xl font-bold leading-[1.05]">
          Ton campus,
          <br />
          en un seul endroit
        </h1>
        <p className="text-sm text-muted">
          Foot, rencontres et réseau pro. Connecte-toi avec ton numéro, sans mot de passe.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Input
          label="Numéro de téléphone"
          placeholder="+237 6…"
          inputMode="tel"
          autoComplete="tel"
        />
        <Input
          label="Code reçu par WhatsApp"
          placeholder="4 8 2 1"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          hint="Code valable 5 minutes."
        />
        <Button block asChild>
          <Link href="/">Continuer</Link>
        </Button>
        <p className="text-center text-xs text-muted">Renvoyer dans 0:42</p>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        En continuant tu acceptes les conditions et la politique de confidentialité, écrites
        simplement. Ton numéro n’est jamais affiché aux autres étudiants.
      </p>

      <p className="text-center text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="font-semibold text-accent-text">
          S’inscrire
        </Link>
      </p>
    </div>
  );
}
