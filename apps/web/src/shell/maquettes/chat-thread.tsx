'use client';

import { Button } from '@conexa/ui';
import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { chatSeed } from './data';
import { filterMessage, rejectionMessage } from './chat-filter';

interface Message {
  id: string;
  from: 'me' | 'peer' | 'system';
  text: string;
  at: string;
}

const QUICK_CARDS = ['J’arrive', 'Je suis en retard', 'Je suis devant l’entrée'];

/**
 * Fil de démonstration : l'envoi est local, le filtre imite la règle serveur
 * (chiffres, liens, pseudos, demandes de contact). Aucune persistance.
 */
export function ChatThread({ peer }: { peer: string }) {
  const [messages, setMessages] = useState<Message[]>(chatSeed);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages]);

  function send(text: string) {
    const clean = text.trim();
    if (clean === '') return;
    const result = filterMessage(clean);
    if (result.blocked) {
      setError(rejectionMessage(result.reasons));
      return;
    }
    setError('');
    setDraft('');
    setMessages((current) => [
      ...current,
      { id: `m${current.length + 1}`, from: 'me', text: clean, at: now() },
    ]);
    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: `m${current.length + 1}`,
          from: 'peer',
          text: 'D’accord, à dimanche alors !',
          at: now(),
        },
      ]);
    }, 900);
  }

  return (
    <div className="flex min-h-[70dvh] flex-col gap-3">
      <div className="flex flex-1 flex-col gap-2.5">
        {messages.map((message) =>
          message.from === 'system' ? (
            <p key={message.id} className="text-center text-xs text-muted">
              {message.text}
            </p>
          ) : (
            <div
              key={message.id}
              className={`max-w-[82%] rounded-panel px-3.5 py-2.5 text-sm ${
                message.from === 'me'
                  ? 'self-end bg-accent text-accent-ink'
                  : 'self-start bg-surface2 text-ink'
              }`}
            >
              <p>{message.text}</p>
              <p
                className={`mt-1 font-mono text-[10px] ${
                  message.from === 'me' ? 'text-accent-ink/70' : 'text-muted'
                }`}
              >
                {message.at}
              </p>
            </div>
          ),
        )}
        <div ref={end} />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {QUICK_CARDS.map((card) => (
          <button
            key={card}
            type="button"
            onClick={() => setDraft(card)}
            className="min-h-11 whitespace-nowrap rounded-full border border-line px-3 text-xs font-semibold text-ink"
          >
            {card}
          </button>
        ))}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <label htmlFor="chat-message" className="sr-only">
          Message pour {peer}
        </label>
        <textarea
          id="chat-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={1}
          maxLength={280}
          placeholder={`Écrire à ${peer}…`}
          className="min-h-12 flex-1 resize-none rounded-token border-[1.5px] border-line bg-surface px-3.5 py-3 text-[15px] text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
        />
        <Button type="submit" aria-label="Envoyer" className="h-12 w-12 px-0">
          <Send className="h-5 w-5" aria-hidden />
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted">
          Les numéros, liens et demandes de contact sont bloqués : les horaires se fixent avec les
          cartes.
        </p>
      )}
    </div>
  );
}

function now(): string {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
