'use client';

import { useEffect, useState } from 'react';

import { useTheme } from '../theme';
import { Toggle } from './kit';

/** Contrôles réels de la maquette : thème, réduction des animations, visibilité. */
export function AppearanceControls() {
  const { theme, toggleTheme, reducedMotion, setReducedMotion } = useTheme();
  const meet = usePersistedToggle('cxa.meet-visible');
  const pro = usePersistedToggle('cxa.pro-visible');

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-line bg-surface p-3.5">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm text-ink">Thème</span>
        <button
          type="button"
          onClick={toggleTheme}
          className="min-h-9 rounded-full border border-line px-3 text-xs font-bold text-ink"
        >
          {theme === 'dk' ? 'Sombre' : 'Clair'} · changer
        </button>
      </div>
      <Toggle
        on={reducedMotion}
        label="Réduire les animations"
        onClick={() => setReducedMotion(!reducedMotion)}
      />
      <div className="h-px bg-line" />
      <Toggle on={meet.value} label="Visible dans Meet" onClick={() => meet.set(!meet.value)} />
      <Toggle
        on={pro.value}
        label="Visible dans le réseau Pro"
        onClick={() => pro.set(!pro.value)}
      />
    </div>
  );
}

function usePersistedToggle(key: string): {
  value: boolean;
  set: (value: boolean) => void;
} {
  const [value, setValue] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(stored === 'true');
    } catch {
      // Stockage indisponible : valeur par défaut.
    }
  }, [key]);

  return {
    value,
    set: (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Réglage pour la session seulement.
      }
    },
  };
}
