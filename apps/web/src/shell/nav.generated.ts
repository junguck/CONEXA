// Généré par `pnpm --filter @conexa/web gen:registry` depuis src/features/*/nav.ts.
// Ne pas modifier à la main : ajoutez un fichier de navigation dans votre domaine,
// puis relancez la commande.
export interface FeatureNavEntry {
  id: string;
  label: string;
  href: string;
  universe: 'core' | 'foot' | 'meet' | 'pro';
}

export const featureNav: FeatureNavEntry[] = [
  { id: 'demo', label: 'Écran de démonstration', href: '/demo', universe: 'core' },
];
