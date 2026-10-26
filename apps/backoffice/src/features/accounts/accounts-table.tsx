'use client';

import { Badge, Button, Input, Table, chipClass, cn, type TableColumn } from '@conexa/ui';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ACCOUNT_REQUESTS, type AccountRequest } from '../../shell/fixtures';

type Scope = 'pending' | 'refused' | 'all';
type Decision = 'validated' | 'refused';

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: 'pending', label: 'En attente' },
  { value: 'refused', label: 'Refusés' },
  { value: 'all', label: 'Tous' },
];

/**
 * Validation des comptes (maquette BoUsers). Les décisions restent locales :
 * le service Identity tranchera et journalisera (F1.1).
 */
export function AccountsTable() {
  const [scope, setScope] = useState<Scope>('pending');
  const [query, setQuery] = useState('');
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [announcement, setAnnouncement] = useState('');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ACCOUNT_REQUESTS.filter((request) => {
      const inScope =
        scope === 'all' ||
        (scope === 'pending' && request.state === 'pending' && !decisions[request.id]) ||
        (scope === 'refused' &&
          (request.state === 'refused' || decisions[request.id] === 'refused'));
      const matches =
        needle === '' ||
        `${request.name} ${request.program} ${request.level}`.toLowerCase().includes(needle);
      return inScope && matches;
    });
  }, [scope, query, decisions]);

  function decide(request: AccountRequest, decision: Decision) {
    setDecisions((current) => ({ ...current, [request.id]: decision }));
    setAnnouncement(
      decision === 'validated'
        ? `${request.name} validé. La décision sera journalisée par le service Identity.`
        : `${request.name} refusé. Un motif clair lui sera envoyé.`,
    );
  }

  const columns: TableColumn[] = [
    { key: 'student', header: 'Étudiant' },
    { key: 'program', header: 'Filière' },
    { key: 'document', header: 'Justificatif' },
    { key: 'received', header: 'Reçu' },
    { key: 'action', header: 'Action' },
  ];

  const tableRows = rows.map((request) => {
    const decision = decisions[request.id];
    return {
      id: request.id,
      student: <span className="font-display text-base font-bold text-ink">{request.name}</span>,
      program: `${request.program} · ${request.level}`,
      document: (
        <Badge
          tone={
            request.document.tone === 'ok'
              ? 'ok'
              : request.document.tone === 'bad'
                ? 'bad'
                : 'neutral'
          }
        >
          {request.document.label}
        </Badge>
      ),
      received: <span className="font-mono text-xs text-muted">{request.received}</span>,
      action: decision ? (
        <Badge tone={decision === 'validated' ? 'ok' : 'bad'}>
          {decision === 'validated' ? 'Validé' : 'Refusé'}
        </Badge>
      ) : (
        <span className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => decide(request, 'validated')}>
            Valider
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide(request, 'refused')}>
            Refuser
          </Button>
        </span>
      ),
    };
  }) satisfies Array<Record<string, ReactNode>>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {SCOPES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={scope === item.value}
            onClick={() => setScope(item.value)}
            className={chipClass}
          >
            {item.label}
          </button>
        ))}
        <div className="ml-auto w-full max-w-xs">
          <Input
            type="search"
            label="Rechercher un compte"
            placeholder="Nom, filière…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <Table
        caption="Demandes de validation de compte"
        columns={columns}
        rows={tableRows}
        empty="Aucune demande ne correspond à ce filtre."
      />

      <p className="text-xs text-muted">
        Chaque refus envoie un motif clair à l’étudiant, qui peut renvoyer un justificatif. Les
        décisions sont journalisées côté serveur.
      </p>
      <p
        role="status"
        aria-live="polite"
        className={cn('text-xs', announcement ? 'text-ink' : 'sr-only')}
      >
        {announcement}
      </p>
    </div>
  );
}
