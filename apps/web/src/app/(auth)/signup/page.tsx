import { Button, Input, Select } from '@conexa/ui';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-5 py-8">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-[.16em] text-accent-text">Inscription</p>
        <h1 className="font-display text-3xl font-bold leading-tight">Rejoins ton campus</h1>
        <p className="text-sm text-muted">
          Ton matricule sert à vérifier que tu es étudiant. Il reste privé.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Input label="Nom complet" placeholder="Brice Junguck" autoComplete="name" />
        <Input
          label="Numéro de téléphone"
          placeholder="+237 6…"
          inputMode="tel"
          autoComplete="tel"
        />
        <Input label="Matricule étudiant" placeholder="24X…" autoComplete="off" />
        <Select
          label="Filière"
          placeholder="Choisir une filière"
          options={[
            { value: 'info', label: 'Informatique' },
            { value: 'gc', label: 'Génie Civil' },
            { value: 'gestion', label: 'Gestion' },
            { value: 'droit', label: 'Droit' },
          ]}
        />
        <Button block asChild>
          <Link href="/pending">Envoyer ma demande</Link>
        </Button>
      </div>

      <p className="text-xs text-muted">
        Un administrateur valide les inscriptions. Les rencontres sont réservées aux personnes
        majeures.
      </p>
    </div>
  );
}
