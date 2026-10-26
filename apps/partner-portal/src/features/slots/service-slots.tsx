'use client';

import { Button, Input, TickPlate, cn } from '@conexa/ui';
import { useState } from 'react';

import { SERVICE_SLOTS, type ServiceSlot } from '../../shell/fixtures';

/** Créneaux de service (maquette Portal) : ouverture, fermeture et couverts. */
export function ServiceSlots() {
  const [slots, setSlots] = useState<ServiceSlot[]>(SERVICE_SLOTS);
  const [status, setStatus] = useState('');

  function toggle(id: string) {
    setSlots((current) =>
      current.map((slot) => (slot.id === id ? { ...slot, open: !slot.open } : slot)),
    );
    setStatus('Créneau modifié localement. L’enregistrement attend le service Partners.');
  }

  function setCovers(id: string, covers: number) {
    setSlots((current) => current.map((slot) => (slot.id === id ? { ...slot, covers } : slot)));
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {slots.map((slot) => (
          <li key={slot.id}>
            <TickPlate tick={false} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold uppercase text-ink">{slot.label}</p>
                <p className="font-mono text-[11px] text-muted">{slot.window}</p>
              </div>

              <div className="w-24">
                <Input
                  type="number"
                  label="Couverts"
                  inputMode="numeric"
                  min={0}
                  max={80}
                  value={slot.covers}
                  onChange={(event) => setCovers(slot.id, Number(event.target.value))}
                  className="w-full text-center"
                />
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={slot.open}
                aria-label={`${slot.label} : ${slot.open ? 'ouvert' : 'fermé'}`}
                onClick={() => toggle(slot.id)}
                className={cn(
                  'min-h-11 rounded-[2px] border px-3 font-mono text-[11px] uppercase tracking-[.08em]',
                  slot.open
                    ? 'border-accent bg-accent font-bold text-accent-ink'
                    : 'border-line text-muted',
                )}
              >
                {slot.open ? 'Ouvert' : 'Fermé'}
              </button>
            </TickPlate>
          </li>
        ))}
      </ul>

      <p
        role="status"
        aria-live="polite"
        className={cn('text-sm', status ? 'text-ink' : 'sr-only')}
      >
        {status}
      </p>

      <div>
        <Button
          type="button"
          size="sm"
          onClick={() => setStatus('Créneaux prêts. Envoi au serveur dès le branchement.')}
        >
          Enregistrer les créneaux
        </Button>
      </div>

      <p className="text-xs text-muted">
        Un créneau fermé n’apparaît plus dans Meet. Les réservations déjà confirmées restent
        honorées.
      </p>
    </div>
  );
}
