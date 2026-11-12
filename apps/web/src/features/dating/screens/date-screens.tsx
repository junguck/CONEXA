'use client';

import { Badge, Button, Card, EmptyState, Input, Skeleton } from '@conexa/ui';
import type { DatingDate } from '@conexa/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Field, Hint, TopBar } from '../../../shell/maquettes/kit';
import { datingApi, type SagaView } from '../api';
import { useAsync } from '../use-async';

const STATUS_LABEL: Record<DatingDate['status'], string> = {
  negotiating: 'Négociation',
  awaiting_payment: 'Paiement attendu',
  confirmed: 'Confirmé',
  checked_in: 'Sur place',
  completed: 'Terminé',
  cancelled: 'Annulé',
  no_show: 'Absence',
  disputed: 'Litige',
};

function errorText(code: string | null): string {
  switch (code) {
    case 'CANCEL_WINDOW_CLOSED':
      return 'Annulation impossible : moins de 3 h avant le date.';
    case 'CONTACT_NOT_REVEALED':
      return 'Contact masqué : il ne s’ouvre qu’après le check-in des deux participants.';
    case 'SLOT_FULL':
      return 'Ce créneau vient d’être pris. Choisis-en un autre.';
    case 'AGE_RESTRICTED':
      return 'Le module est réservé aux majeurs.';
    default:
      return code ? `Action impossible (${code}).` : '';
  }
}

export function DatesScreen() {
  const dates = useAsync(() => datingApi.dates());
  const received = useAsync(() => datingApi.invites('received'));
  const [notice, setNotice] = useState<string | null>(null);

  async function act(run: () => Promise<unknown>, ok: string) {
    setNotice(null);
    try {
      await run();
      setNotice(ok);
      dates.reload();
      received.reload();
    } catch (cause) {
      setNotice(errorText(cause instanceof Error && 'code' in cause ? String(cause.code) : null));
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Mes dates" back="/meet" eyebrow="Rencontres" />

      {received.data && received.data.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <p className="font-display text-sm font-bold">Invitations reçues</p>
          {received.data.map((invite) => (
            <div key={invite.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-ink">Semaine du {invite.week_start}</span>
              <Button
                size="sm"
                onClick={() => void act(() => datingApi.acceptInvite(invite.id), 'Date créé.')}
              >
                Accepter
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void act(() => datingApi.declineInvite(invite.id), 'Invitation refusée.')
                }
              >
                Refuser
              </Button>
            </div>
          ))}
        </Card>
      ) : null}

      {dates.loading ? <Skeleton className="h-32 w-full" /> : null}
      {dates.error ? <Card>Dates indisponibles ({dates.error}).</Card> : null}
      {!dates.loading && dates.data && dates.data.length === 0 ? (
        <EmptyState
          title="Aucun date"
          description="Accepte une invitation ou invite une proposition."
        />
      ) : null}

      {dates.data?.map((date) => (
        <Card key={date.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-sm font-bold">{STATUS_LABEL[date.status]}</p>
            <Badge tone={date.can_cancel ? 'ok' : 'neutral'}>
              {date.i_am_payer ? 'Je paie' : 'L’autre paie'}
            </Badge>
          </div>
          <p className="text-xs text-muted">
            {date.cancellable_until
              ? `Annulation libre jusqu’au ${new Date(date.cancellable_until).toLocaleString('fr-FR')}`
              : 'Créneau à choisir'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/meet/lieu?id=${date.id}`}>Lieu et créneau</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/meet/paiement?id=${date.id}`}>Paiement</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/meet/jour?id=${date.id}`}>Jour J</Link>
            </Button>
          </div>
        </Card>
      ))}

      {notice ? <Hint>{notice}</Hint> : null}
    </div>
  );
}

export function DayScreen({ dateId }: { dateId: string | null }) {
  const state = useAsync(
    () => (dateId ? datingApi.date(dateId) : Promise.reject(new Error('MISSING_DATE'))),
    [dateId],
  );
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [contact, setContact] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  useEffect(() => {
    setContact(null);
    setContactError(null);
  }, [dateId]);

  if (!dateId) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <TopBar title="Jour J" back="/meet/dates" />
        <Card>Aucun date sélectionné.</Card>
      </div>
    );
  }

  async function checkin() {
    setNotice(null);
    try {
      await datingApi.checkin(dateId!, code);
      setNotice('Check-in enregistré.');
      state.reload();
    } catch (cause) {
      setNotice(errorText(cause instanceof Error && 'code' in cause ? String(cause.code) : null));
    }
  }

  async function reveal() {
    setContactError(null);
    try {
      const result = await datingApi.contact(dateId!);
      setContact(result.whatsapp);
    } catch (cause) {
      setContactError(
        errorText(cause instanceof Error && 'code' in cause ? String(cause.code) : null),
      );
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Jour J"
        back="/meet/dates"
        eyebrow={state.data ? STATUS_LABEL[state.data.status] : 'Chargement'}
      />

      {state.loading ? <Skeleton className="h-32 w-full" /> : null}
      {state.error ? <Card>{errorText(state.error)}</Card> : null}

      {state.data ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Lieu" value={state.data.restaurant_id ?? 'À choisir'} />
            <Field label="Créneau" value={state.data.slot_id ?? 'À choisir'} />
          </div>

          <Card className="flex flex-col gap-2">
            <p className="font-display text-sm font-bold">Check-in</p>
            <p className="text-xs text-muted">
              Le code s’affiche côté restaurant. Le contact ne se révèle qu’après le check-in des
              deux participants.
            </p>
            <Input
              label="Code de check-in"
              inputMode="numeric"
              placeholder="Code à 6 chiffres"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Button block disabled={code.length < 4} onClick={() => void checkin()}>
              Je suis arrivé(e)
            </Button>
          </Card>

          <Card className="flex flex-col gap-2">
            <p className="font-display text-sm font-bold">Contact</p>
            <p className="font-mono text-sm">{contact ?? '••• •• •• ••'}</p>
            {contactError ? <p className="text-xs text-muted">{contactError}</p> : null}
            <Button variant="outline" block onClick={() => void reveal()}>
              Afficher le contact
            </Button>
          </Card>

          <Button
            variant="outline"
            block
            onClick={() => void datingApi.sos(dateId).then(() => setNotice('Alerte envoyée.'))}
          >
            SOS : alerter le restaurant et l’admin
          </Button>

          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href={`/meet/feedback?id=${dateId}`}>Donner mon retour</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() =>
                void datingApi
                  .cancel(dateId)
                  .then(() => setNotice('Date annulé.'))
                  .catch((cause: unknown) =>
                    setNotice(
                      errorText(
                        cause instanceof Error && 'code' in cause ? String(cause.code) : null,
                      ),
                    ),
                  )
              }
            >
              Annuler
            </Button>
          </div>
        </>
      ) : null}

      {notice ? <Hint>{notice}</Hint> : null}
    </div>
  );
}

export function FeedbackScreen({ dateId }: { dateId: string | null }) {
  const [rating, setRating] = useState(0);
  const [wantsContact, setWantsContact] = useState<boolean | null>(null);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!dateId) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <TopBar title="Retour" back="/meet/dates" />
        <Card>Aucun date sélectionné.</Card>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex flex-1 flex-col gap-4 pb-4">
        <TopBar title="Merci" back="/meet/dates" />
        <Card className="flex flex-col gap-2">
          <p className="font-display text-lg font-bold">Retour enregistré</p>
          <p className="text-sm text-muted">
            Ce retour reste privé. Le contact, lui, dépend uniquement du check-in des deux
            participants — pas de ce formulaire.
          </p>
        </Card>
        <Button asChild block>
          <Link href="/meet/dates">Retour à mes dates</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Comment s’est passé le date ?" back="/meet/dates" eyebrow="Retour privé" />

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-muted">Une note globale, sans commentaire public.</p>
        <div className="flex gap-1.5" role="group" aria-label="Note du date">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rating === value}
              aria-label={`${value} sur 5`}
              onClick={() => setRating(value)}
              className={`h-12 flex-1 rounded-token border text-sm font-bold ${
                rating >= value
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line text-muted'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Souhaites-tu garder le contact ?</p>
          <div className="flex gap-2">
            <Button
              variant={wantsContact === true ? 'primary' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setWantsContact(true)}
            >
              Oui
            </Button>
            <Button
              variant={wantsContact === false ? 'primary' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setWantsContact(false)}
            >
              Non
            </Button>
          </div>
        </div>

        <Button
          block
          disabled={rating === 0 || wantsContact === null}
          onClick={() => {
            void datingApi
              .feedback(dateId, {
                wants_contact: wantsContact === true,
                criteria: {
                  conversation: rating,
                  values: rating,
                  attraction: rating,
                  punctuality: rating,
                },
              })
              .then(() => setSent(true))
              .catch((cause: unknown) =>
                setNotice(
                  errorText(cause instanceof Error && 'code' in cause ? String(cause.code) : null),
                ),
              );
          }}
        >
          Envoyer mon retour
        </Button>
      </Card>

      {notice ? <Hint>{notice}</Hint> : null}
      <Hint>Le retour est facultatif et jamais partagé avec le restaurant.</Hint>
    </div>
  );
}

export function PaymentScreen({ dateId }: { dateId: string | null }) {
  const state = useAsync(
    () => (dateId ? datingApi.date(dateId) : Promise.reject(new Error('MISSING_DATE'))),
    [dateId],
  );
  const [saga, setSaga] = useState<SagaView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!dateId) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <TopBar title="Paiement" back="/meet/dates" />
        <Card>Aucun date sélectionné.</Card>
      </div>
    );
  }

  async function pay() {
    setNotice(null);
    try {
      const intent = await datingApi.pay(dateId!, `date-${dateId}-${Date.now()}`);
      setSaga({
        date_id: dateId!,
        state: intent.status as SagaView['state'],
        failure_reason: null,
        attempt: 1,
      });
      state.reload();
    } catch (cause) {
      setNotice(errorText(cause instanceof Error && 'code' in cause ? String(cause.code) : null));
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Paiement" back="/meet/dates" eyebrow="Le payeur règle la totalité" />

      {state.loading ? <Skeleton className="h-32 w-full" /> : null}
      {state.error ? <Card>{errorText(state.error)}</Card> : null}

      {state.data ? (
        <Card className="flex flex-col gap-2">
          <Field label="Total" value={`${state.data.total_fcfa} FCFA`} />
          <Field label="Commission" value={`${state.data.commission_fcfa} FCFA`} />
          <p className="text-xs text-muted">
            Aucun crédit restaurant, aucun solde : le paiement se fait une fois, sans remboursement
            en crédit.
          </p>
          {!state.data.slot_id ? (
            <Button asChild block variant="outline">
              <Link href={`/meet/lieu?id=${dateId}`}>Choisir un créneau d’abord</Link>
            </Button>
          ) : (
            <Button block disabled={!state.data.i_am_payer} onClick={() => void pay()}>
              {state.data.i_am_payer ? 'Payer et réserver la table' : 'Seul le payeur règle'}
            </Button>
          )}
          <Button asChild block variant="ghost">
            <Link href={`/meet/paiement/attente?id=${dateId}`}>Suivre le paiement</Link>
          </Button>
        </Card>
      ) : null}

      {saga ? (
        <Hint>Réservation : {saga.state}. Le date se confirme à l’arrivée du séquestre.</Hint>
      ) : null}
      {notice ? <Hint>{notice}</Hint> : null}
    </div>
  );
}

export function PaymentPendingScreen({ dateId }: { dateId: string | null }) {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Paiement en cours" back={`/meet/paiement?id=${dateId ?? ''}`} />
      <Card className="flex flex-col gap-2">
        <p className="font-display text-base font-bold">Nous attendons la confirmation</p>
        <p className="text-sm text-muted">
          La table est retenue le temps du paiement. Elle est libérée automatiquement si le paiement
          échoue : aucun crédit n’est conservé.
        </p>
      </Card>
      {dateId ? (
        <Button asChild block>
          <Link href={`/meet/jour?id=${dateId}`}>Voir mon date</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function PaymentFailureScreen({ dateId }: { dateId: string | null }) {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Paiement échoué" back={`/meet/paiement?id=${dateId ?? ''}`} />
      <Card className="flex flex-col gap-2">
        <p className="font-display text-base font-bold">Aucun débit conservé</p>
        <p className="text-sm text-muted">
          La retenue de table est libérée. Aucun remboursement en crédit restaurant n’existe : tu
          peux simplement réessayer.
        </p>
      </Card>
      {dateId ? (
        <Button asChild block>
          <Link href={`/meet/paiement?id=${dateId}`}>Réessayer</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function PaymentReceiptScreen({ dateId }: { dateId: string | null }) {
  const state = useAsync(
    () => (dateId ? datingApi.date(dateId) : Promise.reject(new Error('MISSING_DATE'))),
    [dateId],
  );

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Reçu" back={`/meet/paiement?id=${dateId ?? ''}`} />
      <Card className="flex flex-col gap-2">
        <p className="font-display text-base font-bold">Paiement confirmé</p>
        {state.data ? (
          <>
            <Field label="Total" value={`${state.data.total_fcfa} FCFA`} />
            <Field label="Statut" value={STATUS_LABEL[state.data.status]} />
          </>
        ) : (
          <p className="text-sm text-muted">Reçu indisponible ({state.error ?? 'chargement'}).</p>
        )}
        <p className="text-xs text-muted">Aucun numéro de carte n’est stocké ni renvoyé.</p>
      </Card>
      {dateId ? (
        <Button asChild block>
          <Link href={`/meet/jour?id=${dateId}`}>Ouvrir mon date</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function MatchScreen({ dateId }: { dateId: string | null }) {
  return (
    <div className="flex min-h-[75dvh] flex-col items-center justify-center gap-4 py-10 text-center">
      <p className="font-mono text-xs uppercase tracking-[.16em] text-accent-text">
        C’est un match
      </p>
      <h1 className="font-display text-3xl font-bold leading-tight">Votre date est créé</h1>
      <p className="max-w-xs text-sm text-muted">
        Choisissez un restaurant partenaire et un créneau. Le contact ne sera révélé qu’après votre
        check-in à tous les deux.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button asChild block>
          <Link href={`/meet/lieu?id=${dateId ?? ''}`}>Choisir un restaurant</Link>
        </Button>
        <Button asChild block variant="outline">
          <Link href="/meet/dates">Voir mes dates</Link>
        </Button>
      </div>
    </div>
  );
}

export function PlaceScreen({ dateId }: { dateId: string | null }) {
  const venues = useAsync(() => datingApi.venues(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const slots = useAsync(
    () => (selected ? datingApi.venueSlots(selected) : Promise.resolve([])),
    [selected],
  );
  const [notice, setNotice] = useState<string | null>(null);

  if (!dateId) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <TopBar title="Choisir un restaurant" back="/meet/dates" />
        <Card>Aucun date sélectionné.</Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Choisir un restaurant" back="/meet/dates" eyebrow="Lieux partenaires" />

      {venues.loading ? <Skeleton className="h-32 w-full" /> : null}
      {venues.error ? <Card>Lieux indisponibles ({venues.error}).</Card> : null}

      {venues.data?.map((venue) => (
        <Card key={venue.id} className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-base font-bold">{venue.name}</p>
              <p className="text-xs text-muted">
                {venue.city} · {venue.address}
              </p>
            </div>
            <Badge tone="accent">Partenaire</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSelected(venue.id)}>
            Voir les créneaux
          </Button>
        </Card>
      ))}

      {selected ? (
        <Card className="flex flex-col gap-2">
          <p className="font-display text-sm font-bold">Créneaux disponibles</p>
          {slots.loading ? <p className="text-sm text-muted">Chargement…</p> : null}
          {slots.data?.length === 0 ? (
            <p className="text-sm text-muted">Aucun créneau ouvert.</p>
          ) : null}
          {slots.data?.map((slot) => (
            <Button
              key={slot.id}
              size="sm"
              variant="outline"
              block
              onClick={() => {
                void datingApi
                  .setSlot(dateId, { restaurant_id: selected, slot_id: slot.id })
                  .then(() => setNotice('Créneau retenu.'))
                  .catch((cause: unknown) =>
                    setNotice(
                      errorText(
                        cause instanceof Error && 'code' in cause ? String(cause.code) : null,
                      ),
                    ),
                  );
              }}
            >
              {new Date(slot.starts_at).toLocaleString('fr-FR')}
            </Button>
          ))}
        </Card>
      ) : null}

      {notice ? <Hint>{notice}</Hint> : null}
      <Hint>Les créneaux viennent de Partners. Aucun prix n’est calculé dans l’application.</Hint>
      <Button asChild block>
        <Link href={`/meet/paiement?id=${dateId}`}>Continuer vers le paiement</Link>
      </Button>
    </div>
  );
}

/** Le fil de discussion d’un date appartient au service realtime, pas à dating. */
export function ChatScreen() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Conversation du date" back="/meet/dates" />
      <Card className="flex flex-col gap-2">
        <p className="font-display text-base font-bold">Bientôt disponible</p>
        <p className="text-sm text-muted">
          Le fil du date est fourni par le service realtime (messagerie et filtre anti-numéros), qui
          n’expose pas encore de fil lié à un date. Aucun numéro ni lien ne circule ici.
        </p>
      </Card>
      <Button asChild block variant="outline">
        <Link href="/meet/dates">Retour à mes dates</Link>
      </Button>
    </div>
  );
}
