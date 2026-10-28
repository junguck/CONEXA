'use client';

import { Button, Input, TickPlate, cn } from '@conexa/ui';
import { useState } from 'react';

import { MENU_DUO, type MenuDuo } from '../../shell/fixtures';

/**
 * Menu duo et prix (maquette Portal). Le formulaire valide la saisie, puis
 * s'arrête : l'écriture partira au service Partners, jamais depuis le front.
 */
export function MenuEditor() {
  const [draft, setDraft] = useState<MenuDuo>(MENU_DUO);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  function update(field: keyof MenuDuo, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus('');
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (draft.name.trim().length < 3) {
      setError('Le nom du menu doit faire au moins 3 caractères.');
      return;
    }
    if (!/^\d{3,6}$/.test(draft.price.trim())) {
      setError('Indiquez un prix entier en XAF, sans espace ni séparateur.');
      return;
    }
    setStatus(
      'Brouillon prêt. L’enregistrement sera envoyé au service Partners dès son branchement.',
    );
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-4" noValidate>
      <TickPlate className="flex flex-col gap-4">
        <Input
          label="Nom du menu"
          value={draft.name}
          onChange={(event) => update('name', event.target.value)}
          aria-invalid={error !== '' || undefined}
        />

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[.1em] text-muted">
            Description
          </span>
          <textarea
            value={draft.description}
            onChange={(event) => update('description', event.target.value)}
            rows={3}
            className="rounded-token border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink focus-visible:border-accent focus-visible:outline-none"
          />
        </label>

        <Input
          label="Prix par personne (XAF)"
          inputMode="numeric"
          value={draft.price}
          onChange={(event) => update('price', event.target.value)}
          aria-invalid={error !== '' || undefined}
          hint="Prix affiché aux étudiants, service compris. Annulation gratuite jusqu’à 3 h avant le date."
        />
      </TickPlate>

      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
      <p
        role="status"
        aria-live="polite"
        className={cn('text-sm', status ? 'text-ink' : 'sr-only')}
      >
        {status}
      </p>

      <div>
        <Button type="submit" size="sm">
          Enregistrer le menu
        </Button>
      </div>
    </form>
  );
}
