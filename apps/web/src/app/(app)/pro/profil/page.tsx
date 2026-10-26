import { Avatar, Badge, Button, Card } from '@conexa/ui';

import { Hint, TopBar } from '../../../../shell/maquettes/kit';

const skills = [
  { name: 'Structure béton armé', endorsements: 12 },
  { name: 'AutoCAD', endorsements: 9 },
  { name: 'Gestion de chantier', endorsements: 6 },
];

export default function ProProfilePage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Mon profil Pro"
        back="/pro"
        right={
          <Button size="sm" variant="outline">
            Modifier
          </Button>
        }
      />

      <div
        className="h-24 rounded-panel"
        style={{ background: 'linear-gradient(120deg,#1469C7,#45C4FF 70%,#0B2A55)' }}
      />
      <div className="-mt-12 flex items-end gap-3 px-2">
        <Avatar name="Brice Junguck" size="lg" className="border-4 border-bg" />
        <div className="pb-1">
          <p className="font-display text-lg font-bold">Brice Junguck</p>
          <p className="text-xs text-muted">Génie Civil · L3 · Douala</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone="ok">Profil vérifié</Badge>
        <Badge tone="accent">Ouvert aux missions</Badge>
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-bold">Compétences</h2>
        {skills.map((skill) => (
          <div
            key={skill.name}
            className="flex min-h-11 items-center justify-between border-b border-line text-sm last:border-0"
          >
            <span className="font-semibold">{skill.name}</span>
            <span className="text-xs text-muted">{skill.endorsements} recommandations</span>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-bold">À propos</h2>
        <p className="text-sm text-muted">
          Étudiant en génie civil, intéressé par les projets de construction durable et le
          covoiturage entre campus.
        </p>
      </Card>

      <Hint>Les coordonnées privées ne sont jamais affichées sans accord mutuel.</Hint>
    </div>
  );
}
