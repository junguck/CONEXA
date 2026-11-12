'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../../shell/api/client';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Relance la lecture ; à appeler après une action qui change le serveur. */
  reload: () => void;
}

/**
 * Lecture d'une ressource dating : aucune règle métier, seulement l'état
 * d'écran. Un code d'API est conservé tel quel pour l'affichage (`code`).
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .then((value) => {
        if (!active) return;
        setData(value);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof ApiError ? cause.code : 'NETWORK_ERROR');
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // `load` change à chaque rendu : les dépendances explicites font foi.
  }, [tick, ...deps]);

  return { data, error, loading, reload };
}
