'use client';

import { Badge, Button, Card } from '@conexa/ui';
import { Check, RotateCcw, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { operators } from './data';
import { Field, Hint, TopBar } from './kit';

const TOTAL = '8 000 FCFA';

export function PaymentForm() {
  const router = useRouter();
  const [operator, setOperator] = useState('mtn');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phone.replace(/\D/g, '').length < 9) {
      setError('Indique le numéro complet, indicatif compris (ex. +237 6…).');
      return;
    }
    setError('');
    router.push('/meet/paiement/attente');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 pb-4">
      <TopBar title="Paiement" back="/meet/lieu" eyebrow="Étape 2 sur 3" />

      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Restaurant</span>
          <span className="font-semibold">Le Bistrot du Campus</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Formule Confort · 2 personnes</span>
          <span className="font-mono">4 000 FCFA / pers.</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Créneau</span>
          <span className="font-semibold">Dimanche 16:00</span>
        </div>
        <div className="my-1 h-px bg-line" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Total à payer</span>
          <span className="font-mono text-xl font-bold text-accent-text">{TOTAL}</span>
        </div>
        <Hint>Montant placé en séquestre et libéré après le date. Aucun frais supplémentaire.</Hint>
      </Card>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted">
          Opérateur
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {operators.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={operator === item.id}
              onClick={() => setOperator(item.id)}
              className={`min-h-12 rounded-token border-[1.5px] bg-surface px-2 text-sm font-bold ${
                operator === item.id ? 'border-accent text-ink' : 'border-line text-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{operators.find((item) => item.id === operator)?.hint}</p>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[.04em] text-muted">
          Numéro Mobile Money
        </span>
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="+237 6…"
          aria-invalid={error !== '' || undefined}
          className="min-h-12 rounded-token border-[1.5px] border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
        />
        <span className="text-xs text-muted">
          Format international. Ce numéro ne sert qu’au paiement, il n’est jamais montré aux autres
          étudiants.
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : null}

      <Field
        label="Annulation"
        value="Gratuite jusqu’à 3 h avant"
        hint="Après ce délai, la part du restaurant est retenue. Le remboursement est indiqué avant le paiement."
      />

      <Button block type="submit">
        Payer {TOTAL}
      </Button>
      <Button asChild block variant="ghost">
        <Link href="/meet/lieu">Plus tard</Link>
      </Button>
    </form>
  );
}

export function PaymentPending() {
  return (
    <div className="flex flex-1 flex-col gap-4 pb-4">
      <TopBar title="Confirmation" back="/meet/paiement" eyebrow="Étape 3 sur 3" />

      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-accent">
          <ShieldCheck className="h-7 w-7 text-accent-text" aria-hidden />
        </span>
        <p className="font-display text-xl font-bold">En attente de ton opérateur</p>
        <p className="max-w-xs text-sm text-muted">
          Un message MTN MoMo a été envoyé. Valide le débit de {TOTAL} sur ton téléphone : le
          montant reste en séquestre, rien n’est versé au restaurant avant le date.
        </p>
        <Badge tone="accent">Séquestre · CVX-4821</Badge>
      </Card>

      <div className="flex flex-col gap-2">
        <Button asChild block>
          <Link href="/meet/paiement/recu">J’ai validé sur mon téléphone</Link>
        </Button>
        <Button asChild block variant="outline">
          <Link href="/meet/paiement/echec">Le paiement a échoué</Link>
        </Button>
        <Button asChild block variant="ghost">
          <Link href="/meet/dates">Annuler et revenir aux dates</Link>
        </Button>
      </div>

      <Hint>
        Cette étape est simulée dans la maquette : le statut réel viendra du service paiements et du
        webhook Campay.
      </Hint>
    </div>
  );
}

export function PaymentReceipt() {
  return (
    <div className="flex flex-1 flex-col gap-4 pb-4">
      <TopBar title="Paiement confirmé" back="/meet/dates" eyebrow="Reçu" />

      <Card className="flex flex-col items-center gap-2 py-7 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ok text-white">
          <Check className="h-7 w-7" aria-hidden />
        </span>
        <p className="font-display text-xl font-bold">{TOTAL} en séquestre</p>
        <p className="text-sm text-muted">Date confirmé · Dimanche 16:00</p>
        <p className="font-mono text-xs text-muted">Référence CVX-4821</p>
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Restaurant</span>
          <span className="font-semibold">Le Bistrot du Campus</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Table</span>
          <span className="font-semibold">T5 · 2 couverts</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Libération</span>
          <span className="font-semibold">Après le date</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Annulation gratuite</span>
          <span className="font-semibold">Jusqu’à 3 h avant</span>
        </div>
      </Card>

      <Button asChild block>
        <Link href="/meet/jour">Voir le jour du date</Link>
      </Button>
      <Button asChild block variant="outline">
        <Link href="/me/paiements">Mes paiements</Link>
      </Button>

      <Hint>
        Le reçu détaillé et les remboursements restent consultables dans Moi → Mes paiements.
      </Hint>
    </div>
  );
}

export function PaymentFailure() {
  return (
    <div className="flex flex-1 flex-col gap-4 pb-4">
      <TopBar title="Paiement non abouti" back="/meet/paiement" eyebrow="Aucun montant débité" />

      <Card className="flex flex-col gap-2">
        <p className="font-display text-lg font-bold">Le paiement n’a pas été validé</p>
        <ul className="list-disc pl-5 text-sm text-muted">
          <li>Solde Mobile Money insuffisant.</li>
          <li>Code de confirmation expiré ou annulé.</li>
          <li>Numéro différent de celui du compte.</li>
        </ul>
        <Hint>
          Aucun montant n’a été débité et la table reste réservée 15 minutes. Tu peux réessayer avec
          le même opérateur ou un autre.
        </Hint>
      </Card>

      <Button asChild block>
        <Link href="/meet/paiement">
          <RotateCcw className="h-4 w-4" aria-hidden /> Réessayer
        </Link>
      </Button>
      <Button asChild block variant="ghost">
        <Link href="/meet/lieu">Choisir un autre créneau</Link>
      </Button>
    </div>
  );
}
