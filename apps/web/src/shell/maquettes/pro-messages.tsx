'use client';

import { Avatar, Badge } from '@conexa/ui';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import { proConversation, proThreads } from './data';
import { ChatThread } from './chat-thread';
import { TopBar } from './kit';

export function ProMessages() {
  const [threads, setThreads] = useState(proThreads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = threads.find((thread) => thread.id === activeId);

  if (active) {
    return (
      <div className="flex flex-1 flex-col gap-2 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Retour aux messages"
            onClick={() => setActiveId(null)}
            className="flex h-11 w-11 items-center justify-center rounded-token border border-line"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{active.name}</p>
            <p className="truncate text-xs text-muted">{active.headline}</p>
          </div>
          <Badge tone="ok">Relation acceptée</Badge>
        </div>
        <ChatThread
          peer={active.name}
          seed={proConversation}
          quickCards={['Je suis disponible', 'Envoyer le brief', 'On en parle demain']}
          reply="Très bien, je t’envoie le brief demain matin."
          notice="Coordonnées privées masquées jusqu’à un accord explicite. Les chiffres et liens sont filtrés."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Messages" back="/pro" eyebrow="Relations acceptées" />
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => {
                setActiveId(thread.id);
                setThreads((current) =>
                  current.map((item) => (item.id === thread.id ? { ...item, unread: 0 } : item)),
                );
              }}
              className="flex w-full min-h-16 items-center gap-3 py-3 text-left"
            >
              <Avatar name={thread.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">{thread.name}</span>
                <span className="block truncate text-xs text-muted">{thread.last}</span>
              </span>
              {thread.unread > 0 ? <Badge tone="accent">{thread.unread}</Badge> : null}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Aucun message d’un compte non accepté. Les invitations limitent les contacts, pas l’inverse.
      </p>
    </div>
  );
}
