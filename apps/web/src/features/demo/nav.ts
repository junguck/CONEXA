/**
 * Exemple de fiche de navigation d'un domaine. Un agent de domaine dépose ce
 * fichier dans son dossier `features/<domaine>/`, relance `gen:registry` et sa
 * destination apparaît sur l'accueil, sans modifier de fichier partagé.
 */
const nav = {
  label: 'Écran de démonstration',
  href: '/demo',
  universe: 'core' as const,
  order: 10,
};

export default nav;
