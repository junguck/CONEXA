'use client';

import { Button, Card, Input } from '@conexa/ui';
import { useState } from 'react';

import { Toggle } from './kit';

const PREFERENCES = [
  {
    id: 'promo',
    label: 'Offres des partenaires',
    hint: 'Désactivées par défaut, 3 par jour maximum.',
    initial: false,
  },
  {
    id: 'push',
    label: 'Notifications push',
    hint: 'Matchs, dates et messages. Toujours désactivables.',
    initial: true,
  },
  {
    id: 'email',
    label: 'Résumé par e-mail',
    hint: 'Un seul envoi par semaine, jamais de relance.',
    initial: false,
  },
];

export function PrivacyControls() {
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(PREFERENCES.map((item) => [item.id, item.initial])),
  );
  const [exported, setExported] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleted, setDeleted] = useState(false);

  if (deleted) {
    return (
      <Card className="flex flex-col gap-2">
        <p className="font-display text-lg font-bold">Demande de suppression enregistrée</p>
        <p className="text-sm text-muted">
          Dans la version réelle, un délai de 30 jours permet d’annuler la demande. Les données de
          paiement sont conservées selon la loi, jamais le profil ni les messages.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Notifications
        </h2>
        <Card className="flex flex-col divide-y divide-line p-0">
          {PREFERENCES.map((item) => (
            <div key={item.id} className="flex flex-col gap-0.5 px-3.5 py-2.5">
              <Toggle
                on={prefs[item.id] ?? false}
                label={item.label}
                onClick={() =>
                  setPrefs((current) => ({ ...current, [item.id]: !current[item.id] }))
                }
              />
              <span className="text-xs text-muted">{item.hint}</span>
            </div>
          ))}
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Mes données
        </h2>
        <Button variant="outline" block onClick={() => setExported(true)}>
          Exporter mes données
        </Button>
        {exported ? (
          <p role="status" className="text-xs text-ok">
            Demande enregistrée : l’archive sera envoyée par e-mail sous 24 h (démo).
          </p>
        ) : null}
        <p className="text-xs text-muted">
          L’export contient ton profil, tes dates, tes messages et l’historique de paiement.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Suppression du compte
        </h2>
        <p className="text-sm text-muted">
          La suppression efface le profil, les dates et les messages. Les données de paiement sont
          conservées selon la loi. Tape « SUPPRIMER » pour confirmer.
        </p>
        <Input
          label="Confirmation"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="SUPPRIMER"
          autoComplete="off"
        />
        <Button
          variant="danger"
          block
          disabled={confirm.trim().toUpperCase() !== 'SUPPRIMER'}
          onClick={() => setDeleted(true)}
        >
          Supprimer définitivement
        </Button>
      </section>
    </div>
  );
}
