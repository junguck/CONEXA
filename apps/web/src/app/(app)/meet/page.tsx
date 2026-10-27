import { Hint, TopBar } from '../../../shell/maquettes/kit';
import { SwipeDeck } from '../../../shell/maquettes/swipe-deck';

export default function MeetSwipePage() {
  return (
    <div className="flex flex-1 flex-col gap-3 pb-4">
      <TopBar
        title="Meet"
        eyebrow="3 propositions cette semaine"
        right={<span className="font-mono text-xs text-muted">3 max</span>}
      />

      <SwipeDeck />

      <Hint>
        Glisse à droite pour inviter, à gauche pour passer — ou utilise les boutons. Inviter propose
        un repas dans un restaurant partenaire ; rien n’est payé avant votre accord. Aucun achat ne
        permet d’obtenir plus de propositions.
      </Hint>
    </div>
  );
}
