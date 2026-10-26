import { Badge, Button, Card } from '@conexa/ui';
import { Clock, MapPin, MessageCircle } from 'lucide-react';

import { Field, Hint, Photo, TopBar } from '../../../../shell/maquettes/kit';

const timeline = [
  { time: '15:55', label: 'Arrivée au restaurant', done: false },
  { time: '16:00', label: 'Table réservée · T5', done: false },
  { time: '18:00', label: 'Fin du date · feedback', done: false },
];

export default function MeetDayPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Dimanche 16:00" back="/meet/dates" eyebrow="Date confirmé" />

      <Card className="flex items-center gap-3">
        <Photo name="Mireille" variant={1} className="h-14 w-14 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold">Mireille, 21</p>
          <p className="text-xs text-muted">Gestion · L3</p>
        </div>
        <Badge tone="ok">Confirmé</Badge>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Lieu" value="Bistrot du Campus" hint="Bonapriso" />
        <Field label="Table" value="T5" hint="Formule Confort" />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          <MapPin className="h-4 w-4" aria-hidden /> Itinéraire
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          <Clock className="h-4 w-4" aria-hidden /> Je suis en retard
        </Button>
      </div>

      <Card className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="h-4 w-4 text-accent-text" aria-hidden /> Cartes du date
        </div>
        <p className="text-sm text-muted">
          Aucun texte libre : choisissez une carte (arrivée, retard, prêt).
        </p>
        <div className="flex flex-wrap gap-1.5">
          {['J’arrive', 'Retard 5 min', 'Je suis prêt'].map((card) => (
            <span
              key={card}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
            >
              {card}
            </span>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-1">
        {timeline.map((step) => (
          <div
            key={step.time}
            className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
          >
            <span className="w-12 font-mono text-xs font-bold text-muted">{step.time}</span>
            <span className="text-sm text-ink">{step.label}</span>
          </div>
        ))}
      </div>

      <Hint>
        Le numéro de téléphone reste masqué : le contact n’est révélé qu’après un « oui » mutuel.
      </Hint>
    </div>
  );
}
