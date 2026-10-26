'use client';

import { Avatar, Badge, Button, Input } from '@conexa/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { proInvitations, proSuggestions } from './data';
import { Hint, TopBar } from './kit';

const WEEKLY_LIMIT = 3;

export function NetworkBoard() {
  const [invitations, setInvitations] = useState(proInvitations);
  const [suggestions, setSuggestions] = useState(proSuggestions);
  const [invited, setInvited] = useState<string[]>([]);
  const [relations, setRelations] = useState<Array<{ name: string; headline: string }>>([]);
  const [tab, setTab] = useState<'invitations' | 'suggestions' | 'relations'>('invitations');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const needle = query.trim().toLowerCase();
  const matches = (person: { name: string; headline: string }) =>
    needle === '' || `${person.name} ${person.headline}`.toLowerCase().includes(needle);
  const visibleRelations = relations.filter(matches);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return suggestions;
    return suggestions.filter((person) =>
      `${person.name} ${person.headline}`.toLowerCase().includes(needle),
    );
  }, [query, suggestions]);

  function answer(id: string, accepted: boolean, name: string, headline: string) {
    setInvitations((current) => current.filter((invitation) => invitation.id !== id));
    if (accepted) {
      setRelations((current) => [...current, { name, headline }]);
      setTab('relations');
    }
    setStatus(
      accepted
        ? `${name} rejoint ton réseau. Vos coordonnées restent masquées jusqu’à un accord explicite.`
        : `Invitation de ${name} mise de côté. Il n’y a pas de relance automatique.`,
    );
  }

  function invite(id: string, name: string) {
    if (invited.length >= WEEKLY_LIMIT) {
      setStatus('Limite de trois invitations par semaine atteinte. Patiente jusqu’à lundi.');
      return;
    }
    setInvited((current) => [...current, id]);
    setSuggestions((current) => current.filter((person) => person.id !== id));
    setStatus(`Invitation envoyée à ${name}.`);
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Mon réseau"
        back="/pro"
        eyebrow={`${invitations.length} invitation(s)`}
        right={
          <Badge tone="accent">
            {invited.length} / {WEEKLY_LIMIT}
          </Badge>
        }
      />

      <Input
        label="Rechercher dans mon réseau"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Nom, compétence…"
      />

      <div className="flex gap-1.5" role="tablist" aria-label="Réseau">
        {[
          { id: 'invitations' as const, label: `Invitations · ${invitations.length}` },
          { id: 'suggestions' as const, label: `Suggestions · ${suggestions.length}` },
          { id: 'relations' as const, label: `Réseau · ${relations.length}` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-11 flex-1 rounded-full border px-2 text-xs font-semibold ${
              tab === item.id ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'invitations' ? (
        invitations.length > 0 ? (
          <section className="flex flex-col gap-2">
            {invitations.map((person) => (
              <div
                key={person.id}
                className="flex flex-wrap items-center gap-3 border-b border-line py-2.5"
              >
                <Avatar name={person.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{person.name}</p>
                  <p className="truncate text-xs text-muted">{person.headline}</p>
                  <p className="text-[11px] text-muted">{person.mutual} relations en commun</p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => answer(person.id, true, person.name, person.headline)}
                  >
                    Accepter
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => answer(person.id, false, person.name, person.headline)}
                  >
                    Plus tard
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <p className="py-6 text-center text-sm text-muted">
            Aucune invitation en attente. Les invitations arrivent au fil de tes publications.
          </p>
        )
      ) : null}

      {tab === 'suggestions' ? (
        <section className="flex flex-col gap-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Aucune suggestion pour cette recherche.
            </p>
          ) : null}
          {filtered.map((person) => (
            <div
              key={person.id}
              className="flex min-h-16 items-center gap-3 border-b border-line py-2.5 last:border-0"
            >
              <Avatar name={person.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{person.name}</p>
                <p className="truncate text-xs text-muted">{person.headline}</p>
                <p className="text-[11px] text-muted">{person.mutual} relations en commun</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => invite(person.id, person.name)}>
                Inviter
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {tab === 'relations' ? (
        <section className="flex flex-col gap-2">
          {visibleRelations.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Aucune relation pour l’instant. Accepte une invitation pour agrandir ton réseau.
            </p>
          ) : null}
          {visibleRelations.map((person) => (
            <div
              key={person.name}
              className="flex min-h-16 items-center gap-3 border-b border-line py-2.5 last:border-0"
            >
              <Avatar name={person.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{person.name}</p>
                <p className="truncate text-xs text-muted">{person.headline}</p>
                <Badge tone="ok">Relation acceptée</Badge>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/pro/messages">Écrire</Link>
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      <p role="status" aria-live="polite" className={status ? 'text-xs text-ink' : 'sr-only'}>
        {status}
      </p>

      <Link href="/pro/messages" className="text-sm font-semibold text-accent-text">
        Ouvrir mes messages
      </Link>
      <Link
        href="/pro/emplois"
        className="text-sm font-semibold text-accent-text underline-offset-4 hover:underline"
      >
        Voir les missions proches de mes compétences
      </Link>

      <Hint>
        Trois invitations par semaine, sans achat supplémentaire. Chaque publication peut être
        signalée ; aucun contact privé n’est livré avant accord.
      </Hint>
    </div>
  );
}
