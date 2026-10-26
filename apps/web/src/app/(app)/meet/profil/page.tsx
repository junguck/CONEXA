import { Badge, Button, Card } from '@conexa/ui';
import { Flag, Heart, MapPin } from 'lucide-react';

import { Hint, Photo, TopBar } from '../../../../shell/maquettes/kit';

export default function MeetProfilePage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Mireille, 21"
        back="/meet/dates"
        eyebrow="Profil Meet"
        right={<Badge tone="accent">87 %</Badge>}
      />

      <Photo name="Mireille" variant={1} className="h-64 w-full" />
      <div className="flex items-center gap-2 text-xs text-muted">
        <MapPin className="h-3.5 w-3.5" aria-hidden /> Gestion · L3 · 350 m
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-bold">Ce qui vous rapproche</h2>
        <p className="text-sm text-muted">
          Cuisine, football et voyages. Vous cherchez tous les deux une rencontre posée, sans
          pression.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {['Cuisine', 'Football', 'Voyages'].map((trait) => (
            <Badge key={trait} tone="neutral">
              {trait}
            </Badge>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button className="flex-1">
          <Heart className="h-4 w-4" aria-hidden /> Inviter
        </Button>
        <Button variant="outline" className="flex-1">
          Passer
        </Button>
      </div>

      <button
        type="button"
        className="flex min-h-11 items-center gap-2 text-sm font-semibold text-bad"
      >
        <Flag className="h-4 w-4" aria-hidden /> Signaler ce profil
      </button>

      <Hint>
        Aucun score chiffré de compatibilité n’est exposé, seulement un libellé. Aucun contact
        privé.
      </Hint>
    </div>
  );
}
