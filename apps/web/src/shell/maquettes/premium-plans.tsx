'use client';

import { Badge, Button, Card, Input } from '@conexa/ui';
import { Check } from 'lucide-react';
import { useState } from 'react';

import { Hint, TopBar } from './kit';

const BENEFITS = [
  'Visibilité dans les recommandations Pro',
  'Statistiques de consultation du profil',
  'Invitations supplémentaires, sans achat de swipe',
  'Aucun avantage sportif ni rencontre supplémentaire',
];

type Billing = 'monthly' | 'yearly';

export function PremiumPlans() {
  const [billing, setBilling] = useState<Billing>('monthly');
  const [state, setState] = useState<'idle' | 'checkout' | 'active' | 'cancelled'>('idle');
  const [operator, setOperator] = useState<'mtn' | 'orange'>('mtn');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const price = billing === 'monthly' ? '2 500' : '24 000';
  const period = billing === 'monthly' ? 'mois' : 'an';

  if (state === 'checkout') {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <TopBar title="Paiement Premium" back="/pro/premium" eyebrow="Paiement mobile sécurisé" />
        <Card className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span>Premium · {billing === 'monthly' ? 'mensuel' : 'annuel'}</span>
            <span className="font-mono font-bold">{price} FCFA</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Frais de service</span>
            <span>0 FCFA</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-line pt-1.5 text-sm font-bold">
            <span>À prélever</span>
            <span className="font-mono text-accent-text">{price} FCFA</span>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Opérateur de paiement">
          {[
            { id: 'mtn' as const, label: 'MTN MoMo' },
            { id: 'orange' as const, label: 'Orange Money' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={operator === item.id}
              onClick={() => setOperator(item.id)}
              className={`min-h-12 rounded-token border-[1.5px] text-sm font-bold ${
                operator === item.id
                  ? 'border-accent bg-surface2 text-ink'
                  : 'border-line text-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Input
          label="Numéro de paiement"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+237 6…"
          hint="Un code de confirmation arrive sur ce numéro. Aucun numéro n’est partagé avec les autres membres."
        />

        {error ? (
          <p role="alert" className="text-xs text-bad">
            {error}
          </p>
        ) : null}

        <Button
          block
          onClick={() => {
            if (phone.replace(/\D/g, '').length < 9) {
              setError('Vérifie le numéro lié à ton compte mobile money.');
              return;
            }
            setError('');
            setState('active');
          }}
        >
          Confirmer le paiement
        </Button>
        <Button variant="ghost" block onClick={() => setState('idle')}>
          Annuler
        </Button>
        <p className="text-xs text-muted">
          Maquette : aucun débit réel. En production, le prélèvement est confirmé par l’opérateur
          avant l’activation.
        </p>
      </div>
    );
  }

  if (state === 'active' || state === 'cancelled') {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <TopBar
          title="Premium"
          back="/pro"
          right={
            <Badge tone={state === 'active' ? 'ok' : 'neutral'}>
              {state === 'active' ? 'Actif' : 'Résilié'}
            </Badge>
          }
        />
        <Card className="flex flex-col gap-2">
          <p className="font-display text-xl font-bold">
            {state === 'active' ? 'Premium actif' : 'Premium résilié'}
          </p>
          <p className="text-sm text-muted">
            {state === 'active'
              ? 'Formule mensuelle, renouvellement le 24 novembre. Résiliable à tout moment, sans frais.'
              : 'L’accès reste ouvert jusqu’au 24 novembre, puis le compte repasse en gratuit. Aucun prélèvement supplémentaire.'}
          </p>
          <p className="font-mono text-sm text-ink">
            {price} FCFA / {period}
          </p>
        </Card>
        {state === 'active' ? (
          <Button variant="outline" block onClick={() => setState('cancelled')}>
            Résilier Premium
          </Button>
        ) : (
          <Button block onClick={() => setState('active')}>
            Réactiver Premium
          </Button>
        )}
        <Button asChild variant="ghost" block>
          <a href="/pro">Retour au fil</a>
        </Button>
        <Hint>
          Le plan payant s’appelle Premium. Il ne change ni l’Elo, ni les classements, ni Meet.
        </Hint>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Premium" back="/pro" right={<Badge tone="accent">Plan gratuit</Badge>} />

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Facturation">
        <button
          type="button"
          aria-pressed={billing === 'monthly'}
          onClick={() => setBilling('monthly')}
          className={`min-h-12 rounded-token border-[1.5px] text-sm font-bold ${
            billing === 'monthly' ? 'border-accent bg-surface2 text-ink' : 'border-line text-muted'
          }`}
        >
          Mensuel
        </button>
        <button
          type="button"
          aria-pressed={billing === 'yearly'}
          onClick={() => setBilling('yearly')}
          className={`min-h-12 rounded-token border-[1.5px] text-sm font-bold ${
            billing === 'yearly' ? 'border-accent bg-surface2 text-ink' : 'border-line text-muted'
          }`}
        >
          Annuel · 2 mois offerts
        </button>
      </div>

      <Card className="flex flex-col gap-2">
        <p className="font-display text-2xl font-bold">Premium</p>
        <p className="text-sm text-muted">
          Pour développer ton réseau et trouver des missions. Prix final, sans frais caché.
        </p>
        <p className="font-mono text-3xl font-bold text-accent-text">
          {price} <span className="text-sm">FCFA / {period}</span>
        </p>
        <p className="text-xs text-muted">
          {billing === 'monthly'
            ? 'Facturé chaque mois. Résiliation immédiate, sans justification.'
            : 'Soit 2 000 FCFA par mois sur douze mois, 6 000 FCFA de moins que le mensuel.'}
        </p>
      </Card>

      <div className="flex flex-col gap-2">
        {BENEFITS.map((benefit) => (
          <div key={benefit} className="flex items-start gap-2 text-sm text-ink">
            <Check className="mt-0.5 h-4 w-4 flex-none text-ok" aria-hidden /> {benefit}
          </div>
        ))}
      </div>

      <Button block onClick={() => setState('checkout')}>
        S’abonner à Premium
      </Button>
      <Button asChild block variant="ghost">
        <a href="/pro">Plus tard</a>
      </Button>

      <Hint>
        Aucun compte à rebours ni promotion factice : le prix et la résiliation sont affichés avant
        de payer. L’abonnement ne débloque aucune rencontre supplémentaire.
      </Hint>
    </div>
  );
}
