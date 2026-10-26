/**
 * Exemple de fiche de navigation d'un domaine. Un agent de domaine dépose ce
 * fichier dans `src/features/<domaine>/`, relance `gen:registry` et sa section
 * apparaît dans le back-office, sans modifier de fichier partagé.
 */
const nav = {
  label: 'Démo domaine',
  href: '/demo',
  order: 50,
};

export default nav;
