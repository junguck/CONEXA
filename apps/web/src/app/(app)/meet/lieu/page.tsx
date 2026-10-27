import { Badge, Button, Card } from '@conexa/ui';
import Link from 'next/link';

import { Hint, TopBar } from '../../../../shell/maquettes/kit';

const places = [
  {
    name: 'Le Bistrot du Campus',
    area: 'Bonapriso · 1,2 km',
    offer: 'Formule Confort · 4 500 FCFA / pers.',
    tag: 'Partenaire',
  },
  {
    name: 'Chez Tantie',
    area: 'Akwa · 2,4 km',
    offer: 'Formule Simple · 3 500 FCFA / pers.',
    tag: 'Populaire',
  },
  {
    name: 'La Terrasse',
    area: 'Bonanjo · 3,1 km',
    offer: 'Formule Premium · 7 000 FCFA / pers.',
    tag: 'Nouveau',
  },
];

export default function MeetPlacePage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Choisir un restaurant" back="/meet/match" eyebrow="Étape 1 sur 3" />

      {places.map((place, index) => (
        <Card
          key={place.name}
          className={
            index === 0
              ? 'border-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--ac)_18%,transparent)]'
              : ''
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-bold">{place.name}</p>
              <p className="text-xs text-muted">{place.area}</p>
              <p className="mt-2 text-sm text-ink">{place.offer}</p>
            </div>
            <Badge tone={index === 0 ? 'accent' : 'neutral'}>{place.tag}</Badge>
          </div>
        </Card>
      ))}

      <Hint>
        Distance arrondie, jamais la position exacte. Les prix affichés sont les prix finaux.
      </Hint>
      <Button asChild block>
        <Link href="/meet/paiement">Continuer</Link>
      </Button>
    </div>
  );
}
