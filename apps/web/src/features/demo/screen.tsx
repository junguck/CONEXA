import { Badge, Button, Card } from '@conexa/ui';

/**
 * Écran de démonstration d'un domaine. Un agent de domaine peut copier ce
 * dossier, changer `nav.ts`, et sa route apparaît sans toucher à la coquille.
 */
export function DemoScreen() {
  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <header className="flex flex-col gap-1">
        <Badge tone="accent">Démo</Badge>
        <h1 className="font-display text-2xl font-bold">Écran de démonstration</h1>
        <p className="text-sm text-muted">
          Ce fichier vit dans <code className="font-mono">src/features/demo</code>. Sa navigation
          est générée par le registre.
        </p>
      </header>

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-ink">
          Ajouter un écran ne demande que des fichiers dans le dossier du domaine, puis :
        </p>
        <code className="overflow-x-auto rounded-token bg-surface2 p-3 font-mono text-xs">
          pnpm --filter @conexa/web gen:registry
        </code>
        <Button variant="outline" asChild>
          <a href="/design">Voir les composants</a>
        </Button>
      </Card>
    </div>
  );
}
