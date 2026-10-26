import { Badge, Button, Card } from '@conexa/ui';
import Link from 'next/link';

import { Hint, TopBar } from '../../../shell/maquettes/kit';

const FAQ = [
  {
    q: 'Pourquoi mon profil est-il vérifié manuellement ?',
    a: 'La carte étudiante et le matricule sont contrôlés par une personne, sous 24 h ouvrées. Cela limite les faux profils et les comptes créés pour du spam.',
  },
  {
    q: 'Comment fonctionne le séquestre des paiements ?',
    a: 'Le montant d’un date ou d’une mission est prélevé puis gardé par Convexa. Il est versé au partenaire ou au prestataire après confirmation des deux côtés, ou remboursé selon les règles affichées avant paiement.',
  },
  {
    q: 'Puis-je annuler un date ?',
    a: 'Oui. À plus de 3 h, le remboursement est intégral. Plus tard, des frais peuvent s’appliquer ; le montant exact est affiché avant de confirmer l’annulation.',
  },
  {
    q: 'Qui voit mon numéro WhatsApp ?',
    a: 'Personne. Il sert seulement au code de connexion. Un contact n’est partagé qu’après un accord explicite des deux personnes.',
  },
  {
    q: 'Le classement football peut-il être acheté ?',
    a: 'Non. L’Elo, les classements et les propositions Meet ne sont jamais vendus. Premium ne touche qu’au réseau Pro.',
  },
];

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Aide et charte" back="/me" eyebrow="Support Convexa" />

      <Card className="flex flex-col gap-2">
        <Badge tone="ok">Réponse moyenne : 4 h</Badge>
        <p className="font-display text-lg font-bold">Une question, un blocage ?</p>
        <p className="text-sm text-muted">
          Écris à l’équipe depuis l’app : le message joint ton numéro de dossier, jamais ton mot de
          passe.
        </p>
        <Button asChild block>
          <Link href="/me/securite">Ouvrir un signalement</Link>
        </Button>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Questions fréquentes
        </h2>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink">
                {item.q}
                <span aria-hidden className="font-mono text-muted group-open:hidden">
                  +
                </span>
                <span aria-hidden className="hidden font-mono text-muted group-open:inline">
                  −
                </span>
              </summary>
              <p className="pt-1 text-sm text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Charte de la communauté
        </h2>
        <Card className="flex flex-col gap-2 text-sm text-ink">
          <p>Respect d’abord : aucune insulte, harcèlement ou propos discriminatoire.</p>
          <p>Pas de revente de place, de prêt d’argent ni de contact payant.</p>
          <p>Les photos d’autres personnes ne se publient pas sans accord.</p>
          <p>Un signalement est examiné par une personne, pas par un robot seul.</p>
        </Card>
      </section>

      <Hint>
        En cas de danger immédiat, contacte les secours ou l’administration du campus : l’app ne
        remplace pas les services d’urgence.
      </Hint>
    </div>
  );
}
