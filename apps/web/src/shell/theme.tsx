'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Theme } from './universe';

const THEME_KEY = 'cxa.theme';
const MOTION_KEY = 'cxa.reduced-motion';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Applique le thème de l'univers et mémorise le choix explicite de l'utilisateur. */
export function ThemeProvider({
  defaultTheme,
  children,
}: {
  defaultTheme: Theme;
  children: ReactNode;
}) {
  const [override, setOverride] = useState<Theme | null>(null);
  const [reducedMotion, setReducedMotionState] = useState(false);

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(THEME_KEY);
      if (storedTheme === 'dk' || storedTheme === 'lt') setOverride(storedTheme);
      setReducedMotionState(window.localStorage.getItem(MOTION_KEY) === 'true');
    } catch {
      // Stockage indisponible (navigation privée stricte) : préférences par défaut.
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset['reducedMotion'] = reducedMotion ? 'true' : 'false';
  }, [reducedMotion]);

  const theme = override ?? defaultTheme;

  const toggleTheme = useCallback(() => {
    setOverride((current) => {
      const next: Theme = (current ?? defaultTheme) === 'dk' ? 'lt' : 'dk';
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        // Le thème reste appliqué pour la session en cours.
      }
      return next;
    });
  }, [defaultTheme]);

  const setReducedMotion = useCallback((value: boolean) => {
    setReducedMotionState(value);
    try {
      window.localStorage.setItem(MOTION_KEY, String(value));
    } catch {
      // Idem : réglage valable pour la session.
    }
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, reducedMotion, setReducedMotion }),
    [theme, toggleTheme, reducedMotion, setReducedMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme doit être utilisé à l’intérieur de <ThemeProvider>.');
  }
  return context;
}
