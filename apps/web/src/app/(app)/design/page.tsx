'use client';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Select,
  Sheet,
  Skeleton,
  Table,
  Tabs,
  useToast,
} from '@conexa/ui';
import { Heart, Trophy } from 'lucide-react';
import { useState } from 'react';

import { t } from '../../../i18n';

export default function DesignPage() {
  const [formula, setFormula] = useState('confort');
  const { notify } = useToast();

  return (
    <div className="flex flex-col gap-8 pb-6 pt-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold leading-tight">{t('design.title')}</h1>
        <p className="text-sm text-muted">{t('design.subtitle')}</p>
      </header>

      <Section title={t('design.buttons')}>
        <div className="flex flex-wrap gap-2">
          <Button>Payer 8 000 FCFA</Button>
          <Button variant="outline">Plus tard</Button>
          <Button variant="ghost">Passer</Button>
          <Button variant="danger">Annuler le date</Button>
          <Button size="sm">Petit</Button>
        </div>
        <div className="mt-3">
          <Button block>Action pleine largeur</Button>
        </div>
      </Section>

      <Section title={t('design.fields')}>
        <div className="flex flex-col gap-4">
          <Input label="Nom complet" placeholder="Aïcha N." autoComplete="name" />
          <Input
            label="Numéro WhatsApp"
            placeholder="+237 6…"
            inputMode="tel"
            hint="Masqué après validation, jamais affiché aux autres étudiants."
          />
          <Input label="Matricule" defaultValue="24X" error="Ce matricule est déjà utilisé." />
          <Select
            label="Formule du date"
            value={formula}
            onValueChange={setFormula}
            options={[
              { value: 'simple', label: 'Simple : 3 500 FCFA / personne' },
              { value: 'confort', label: 'Confort : 4 500 FCFA / personne' },
              { value: 'premium', label: 'Premium : 7 000 FCFA / personne' },
            ]}
          />
        </div>
      </Section>

      <Section title={t('design.feedback')}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Nouveau</Badge>
          <Badge tone="live">Direct</Badge>
          <Badge tone="ok">Validé</Badge>
          <Badge tone="bad">Litige</Badge>
          <Badge tone="neutral">Brouillon</Badge>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <Dialog
            title={t('design.dialogTitle')}
            description={t('design.dialogBody')}
            trigger={<Button variant="outline">{t('design.dialog')}</Button>}
            footer={
              <>
                <Button variant="ghost">Plus tard</Button>
                <Button>{t('design.dialogFooter')}</Button>
              </>
            }
          >
            <p className="text-sm text-muted">
              Le montant est fixé par la formule choisie. Aucun frais caché n’est ajouté.
            </p>
          </Dialog>

          <Sheet
            title={t('design.sheetTitle')}
            trigger={<Button variant="outline">{t('design.sheet')}</Button>}
          >
            <p className="pb-2 text-sm text-muted">
              Trois propositions par semaine, sans achat supplémentaire.
            </p>
            <Button
              block
              onClick={() => notify({ title: 'Formule sélectionnée', tone: 'success' })}
            >
              Choisir Confort
            </Button>
          </Sheet>

          <Button
            variant="ghost"
            onClick={() =>
              notify({
                title: t('design.toastTitle'),
                description: t('design.toastBody'),
                tone: 'info',
              })
            }
          >
            {t('design.toast')}
          </Button>
        </div>
      </Section>

      <Section title={t('design.data')}>
        <div className="flex items-center gap-3">
          <Avatar name="Aïcha Nkou" size="lg" />
          <Avatar name="Les Lions" shape="square" />
          <Avatar name="Samuel M." size="sm" />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>

        <div className="mt-4">
          <Tabs
            label="Démonstration des onglets"
            items={[
              {
                value: 'matches',
                label: 'Matchs',
                content: (
                  <Table
                    caption="Derniers matchs"
                    columns={[
                      { key: 'teams', header: 'Équipes' },
                      { key: 'score', header: 'Score', numeric: true },
                      { key: 'status', header: 'Statut' },
                    ]}
                    rows={[
                      { id: '1', teams: 'Lions / Aigles', score: '3 – 1', status: 'Validé' },
                      {
                        id: '2',
                        teams: 'Pan’thères / Requins',
                        score: '2 – 2',
                        status: 'En attente',
                      },
                    ]}
                  />
                ),
              },
              {
                value: 'picks',
                label: 'Meet',
                content: (
                  <EmptyState
                    icon={Heart}
                    title={t('design.emptyTitle')}
                    description={t('design.emptyBody')}
                  />
                ),
              },
              {
                value: 'pro',
                label: 'Pro',
                content: (
                  <Card className="flex items-center gap-3">
                    <Trophy className="h-6 w-6 text-accent-text" aria-hidden />
                    <p className="text-sm text-muted">
                      Les compétences recommandées arrivent avec le module Pro.
                    </p>
                  </Card>
                ),
              },
            ]}
          />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-sm font-bold uppercase tracking-[.08em] text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}
