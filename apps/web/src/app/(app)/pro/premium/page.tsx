import { Badge, Button, Card } from '@conexa/ui';
import { Check } from 'lucide-react';

import { Hint, TopBar } from '../../../../shell/maquettes/kit';

const benefits = [
  'Visibilité dans les recommandations Pro',
  'Statistiques de consultation du profil',
  'Invitations supplémentaires, sans achat de swipe',
  'Aucun avantage sportif ni rencontre supplémentaire',
];

export default function ProPremiumPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Premium" back="/pro" right={<Badge tone="accent">Plan Pro</Badge>} />

      <Card className="flex flex-col gap-2">
        <p className="font-display text-2xl font-bold">Premium</p>
        <p className="text-sm text-muted">
          Pour les étudiants qui veulent développer leur réseau et trouver des missions.
        </p>
        <p className="font-mono text-3xl font-bold text-accent-text">
          2 500 <span className="text-sm">FCFA / mois</span>
        </p>
        <p className="text-xs text-muted">
          Prix final, sans frais caché. Résiliable à tout moment.
        </p>
      </Card>

      <div className="flex flex-col gap-2">
        {benefits.map((benefit) => (
          <div key={benefit} className="flex items-start gap-2 text-sm text-ink">
            <Check className="mt-0.5 h-4 w-4 flex-none text-ok" aria-hidden /> {benefit}
          </div>
        ))}
      </div>

      <Button block>S’abonner à Premium</Button>
      <Button block variant="ghost">
        Plus tard
      </Button>

      <Hint>
        Le plan payant s’appelle Premium dans l’interface. Il ne change ni l’Elo, ni les
        classements, ni le nombre de propositions Meet.
      </Hint>
    </div>
  );
}
