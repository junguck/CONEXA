# Convexa : sources exportables

- `screens/` : une page HTML autonome par écran et par thème (`Nom-dark.html`, `Nom-light.html`). Taille 390 × 844 (mobile) ; Portail et Back-office en 820 × 1000 et 1280 × 800.
- `png/` : captures à l'échelle 2x de chaque écran (références visuelles).
- `assets/` : `cxa.css`, `convexa.css` (back-office), logos (glyphes C, X, Λ, mot-symbole).
- `fonts/` : polices embarquées (Unbounded, Instrument Sans/Serif, JetBrains Mono, Barlow Condensed/Semi Condensed, Outfit, DM Sans, Inter).

## Importer dans Figma
1. Ouvre un écran HTML dans un navigateur depuis le dossier (les chemins sont relatifs).
2. Plugin communautaire « html.to.design » : importe la page ouverte ou le fichier HTML, largeur 390 px (1280 px pour le back-office).
3. Installe les polices ci-dessus dans Figma (elles sont libres de droits, sur Google Fonts).
4. À défaut du plugin : glisse les PNG de `png/` comme fonds de référence et redessine par-dessus.

Les animations ne sont pas exportables : les durées et courbes sont dans `assets/cxa.css` (rechercher `@keyframes`) et dans `DESIGN_HANDOFF.md`.
Les liens entre écrans (barre du bas, boutons) fonctionnent entre les pages HTML mais ne créent pas de prototype Figma : à relier avec « Smart animate ».
