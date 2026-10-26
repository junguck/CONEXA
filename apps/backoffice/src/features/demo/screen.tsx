import { ConsoleNotice, TickPlate } from '@conexa/ui';

const FILES = [
  'src/features/demo/nav.ts (libellé, route, ordre)',
  'src/features/demo/screen.tsx (contenu)',
  'src/app/(admin)/demo/page.tsx (route qui monte le contenu)',
];

/** Écran de démonstration : preuve qu'un domaine n'ajoute que ses fichiers. */
export function DemoScreen() {
  return (
    <div className="flex flex-col gap-4">
      <TickPlate className="flex flex-col gap-3">
        <p className="text-sm text-ink">
          Cet écran n’existe que par trois fichiers de son domaine, plus une entrée générée dans la
          navigation.
        </p>
        <ul className="flex flex-col gap-2">
          {FILES.map((file) => (
            <li key={file} className="font-mono text-xs text-muted">
              {file}
            </li>
          ))}
        </ul>
      </TickPlate>
      <ConsoleNotice>
        Aucun fichier partagé n’est édité : `pnpm --filter @conexa/backoffice gen:registry` relit
        `src/features/*/nav.ts` et régénère la navigation.
      </ConsoleNotice>
    </div>
  );
}
