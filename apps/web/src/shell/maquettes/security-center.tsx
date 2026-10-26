'use client';

import { Badge, Button, Card, Input, Select } from '@conexa/ui';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';

import { Hint, TopBar } from './kit';

const REASONS = [
  { value: 'harcelement', label: 'Harcèlement ou menaces' },
  { value: 'faux-profil', label: 'Faux profil / usurpation' },
  { value: 'arnaque', label: 'Arnaque ou paiement hors app' },
  { value: 'contenu', label: 'Contenu illégal ou choquant' },
];

const SEED_BLOCKED = ['Kevin T.', 'Compte supprimé'];

export function SecurityCenter() {
  const [blocked, setBlocked] = useState(SEED_BLOCKED);
  const [reason, setReason] = useState('harcelement');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [ticket, setTicket] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (details.trim().length < 15) {
      setError('Décris les faits en quelques lignes (15 caractères minimum).');
      return;
    }
    setError('');
    const reference = `SIG-${String(4100 + details.length).slice(-4)}`;
    setTicket(reference);
    if (alsoBlock) setBlocked((current) => [...current, 'Personne signalée']);
    setDetails('');
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Sécurité" back="/me" eyebrow="Signalements et blocages" />

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Comptes bloqués · {blocked.length}
        </h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted">Aucun compte bloqué.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {blocked.map((name) => (
              <li key={name} className="flex min-h-14 items-center gap-3 py-2">
                <ShieldOff className="h-4 w-4 flex-none text-bad" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setBlocked((current) => current.filter((item) => item !== name))}
                >
                  Débloquer
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          Un compte bloqué ne voit plus ton profil, ne peut plus t’inviter ni t’écrire. Tu peux
          débloquer à tout moment.
        </p>
      </section>

      {ticket ? (
        <Card className="flex flex-col gap-2">
          <Badge tone="ok">
            <ShieldCheck className="h-3 w-3" aria-hidden /> Signalement reçu
          </Badge>
          <p className="text-sm text-ink">
            Référence {ticket}. L’équipe de modération répond sous 24 h ouvrées dans l’app.
          </p>
          <p className="text-xs text-muted">
            Ta pièce jointe et tes coordonnées restent visibles seulement par la modération.
          </p>
          <Button size="sm" variant="outline" onClick={() => setTicket('')}>
            Faire un autre signalement
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-sm font-bold">Signaler un comportement</h2>
          <Select label="Motif" value={reason} onValueChange={setReason} options={REASONS} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">
              Faits
            </span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              maxLength={600}
              placeholder="Date, contexte, captures… (aucune coordonnée privée nécessaire)"
              className="rounded-token border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={(event) => setAlsoBlock(event.target.checked)}
              className="mt-0.5 h-5 w-5"
            />
            Bloquer aussi cette personne pendant l’examen.
          </label>
          {error ? (
            <p role="alert" className="text-xs text-bad">
              {error}
            </p>
          ) : null}
          <Button block onClick={submit}>
            Envoyer le signalement
          </Button>
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Conseils
        </h2>
        <Input
          label="Numéro d’urgence campus"
          value="+237 6 00 00 00 00"
          readOnly
          hint="Appel direct, sans passer par l’app, en cas de danger immédiat."
        />
      </section>

      <Hint>
        Le blocage est immédiat et silencieux : la personne n’est pas notifiée. Un signalement
        n’entraîne jamais la fermeture automatique d’un compte.
      </Hint>
    </div>
  );
}
