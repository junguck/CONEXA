'use client';

import { Badge, Button, Card } from '@conexa/ui';
import Link from 'next/link';
import { useState } from 'react';

import { notifications } from './data';
import { Hint, TopBar } from './kit';
import { subscribeToPush } from '../pwa/push';

const VAPID = process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY'] ?? '';

export function NotificationsBoard() {
  const [items, setItems] = useState(notifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pushStatus, setPushStatus] = useState('');

  const visible = filter === 'unread' ? items.filter((item) => item.unread) : items;
  const unread = items.filter((item) => item.unread).length;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Notifications"
        back="/me"
        eyebrow={unread > 0 ? `${unread} non lue(s)` : 'Tout est lu'}
        right={
          unread > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setItems((current) => current.map((item) => ({ ...item, unread: false })))
              }
            >
              Tout lire
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-1.5">
        {[
          { id: 'all' as const, label: 'Tout' },
          { id: 'unread' as const, label: 'Non lues' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`min-h-11 flex-1 rounded-full border text-sm font-semibold ${
              filter === item.id
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Aucune notification non lue.</p>
      ) : null}

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {visible.map((item) => (
          <li key={item.title}>
            <button
              type="button"
              onClick={() =>
                setItems((current) =>
                  current.map((entry) =>
                    entry.title === item.title ? { ...entry, unread: false } : entry,
                  ),
                )
              }
              className="flex w-full items-start gap-3 py-3 text-left"
            >
              <span
                aria-hidden
                className={`mt-1.5 h-2 w-2 flex-none rounded-full ${item.unread ? 'bg-accent' : 'bg-line'}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{item.title}</span>
                <span className="block text-xs text-muted">{item.body}</span>
                <span className="mt-0.5 block font-mono text-[10px] text-muted">{item.time}</span>
              </span>
              {item.unread ? <Badge tone="accent">Nouveau</Badge> : null}
            </button>
          </li>
        ))}
      </ul>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-bold">Notifications push</p>
        <p className="text-xs text-muted">
          Désactivées par défaut, trois par jour maximum. Aucune notification promotionnelle sans
          accord.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            if (VAPID === '') {
              setPushStatus(
                'Clé VAPID absente : l’activation réelle attend la configuration serveur.',
              );
              return;
            }
            const payload = await subscribeToPush(VAPID);
            setPushStatus(
              payload
                ? 'Appareil abonné. Le serveur Realtime enverra les notifications.'
                : 'Autorisation refusée ou navigateur non compatible.',
            );
          }}
        >
          Activer les notifications
        </Button>
        <p role="status" aria-live="polite" className={pushStatus ? 'text-xs text-ink' : 'sr-only'}>
          {pushStatus}
        </p>
        <Link href="/me/confidentialite" className="text-xs font-semibold text-accent-text">
          Régler la fréquence
        </Link>
      </Card>

      <Hint>
        Une notification n’est jamais le seul moyen d’accéder à une information : tout reste
        consultable dans l’app.
      </Hint>
    </div>
  );
}
