import type { ReactNode } from 'react';

/** Écrans sans barre basse (DESIGN_HANDOFF.md §1) : chargement, connexion, inscription, validation. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="s-core dk flex min-h-dvh flex-col bg-bg text-ink">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]">
        {children}
      </main>
    </div>
  );
}
