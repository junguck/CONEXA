import { Button, Card, Input } from '@conexa/ui';

import { Field, Hint, TopBar } from '../../../../shell/maquettes/kit';

export default function MeetPayPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Paiement" back="/meet/lieu" eyebrow="Étape 2 sur 3" />

      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Restaurant</span>
          <span className="font-semibold">Le Bistrot du Campus</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Formule Confort</span>
          <span className="font-mono">4 500 FCFA / pers.</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Créneau</span>
          <span className="font-semibold">Dimanche 16:00</span>
        </div>
        <div className="my-1 h-px bg-line" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Total à payer</span>
          <span className="font-mono text-xl font-bold text-accent-text">8 000 FCFA</span>
        </div>
        <Hint>
          Le montant est placé en séquestre et libéré après le date. Aucun frais supplémentaire.
        </Hint>
      </Card>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted">
          Opérateur
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="min-h-12 rounded-token border-[1.5px] border-accent bg-surface text-sm font-bold text-ink"
          >
            MTN MoMo
          </button>
          <button
            type="button"
            className="min-h-12 rounded-token border-[1.5px] border-line bg-surface text-sm font-bold text-muted"
          >
            Orange Money
          </button>
        </div>
      </div>

      <Input
        label="Numéro Mobile Money"
        placeholder="+237 6…"
        inputMode="tel"
        hint="Format international, MTN ou Orange uniquement."
      />
      <Field
        label="Annulation"
        value="Gratuite jusqu’à 3 h avant"
        hint="Après ce délai, le montant est retenu pour le restaurant."
      />
      <Button block>Payer 8 000 FCFA</Button>
      <Button block variant="ghost">
        Plus tard
      </Button>
    </div>
  );
}
