'use client';

import { Avatar, Badge, Button, Card, Input } from '@conexa/ui';
import { Check, Eye, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { proSkills } from './data';
import { Hint, TopBar } from './kit';

export function ProProfile() {
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState('Génie Civil · L3 · Douala');
  const [about, setAbout] = useState(
    'Étudiant en génie civil, intéressé par les projets de construction durable et le covoiturage entre campus.',
  );
  const [skills, setSkills] = useState(proSkills);
  const [newSkill, setNewSkill] = useState('');
  const [openToWork, setOpenToWork] = useState(true);
  const [endorsed, setEndorsed] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  const checklist = [
    { label: 'Accroche', done: headline.trim().length > 0 },
    { label: 'Présentation', done: about.trim().length >= 40 },
    { label: 'Deux compétences', done: skills.length >= 2 },
    { label: 'Ouvert aux missions', done: openToWork },
  ];
  const completeness = Math.round(
    (checklist.filter((item) => item.done).length / checklist.length) * 100,
  );

  function addSkill() {
    const skill = newSkill.trim();
    if (skill === '' || skills.includes(skill)) return;
    setSkills((current) => [...current, skill]);
    setNewSkill('');
  }

  function save() {
    setEditing(false);
    setStatus('Profil mis à jour localement. L’enregistrement serveur attend le service Talents.');
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Mon profil Pro"
        back="/pro"
        right={
          <Button size="sm" variant="outline" onClick={() => setEditing((value) => !value)}>
            {editing ? 'Fermer' : 'Modifier'}
          </Button>
        }
      />

      <div
        className="h-24 rounded-panel"
        style={{ background: 'linear-gradient(120deg,#1469C7,#45C4FF 70%,#0B2A55)' }}
      />
      <div className="-mt-12 flex items-end gap-3 px-2">
        <Avatar name="Brice Junguck" size="lg" className="border-4 border-bg" />
        <div className="min-w-0 pb-1">
          <p className="font-display text-lg font-bold">Brice Junguck</p>
          <p className="truncate text-xs text-muted">{headline}</p>
        </div>
      </div>

      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold">Profil complété à {completeness} %</h2>
          <Badge tone={completeness === 100 ? 'ok' : 'accent'}>
            {completeness === 100 ? 'Complet' : 'À finir'}
          </Badge>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completeness}
          aria-label="Complétude du profil Pro"
          className="h-2 overflow-hidden rounded-full bg-surface2"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${completeness}%` }}
          />
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {checklist.map((item) => (
            <li
              key={item.label}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                item.done ? 'border-ok/60 text-ok' : 'border-line text-muted'
              }`}
            >
              {item.done ? <Check className="h-3 w-3" aria-hidden /> : null} {item.label}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone="ok">Profil vérifié</Badge>
        <Badge tone={openToWork ? 'accent' : 'neutral'}>
          {openToWork ? 'Ouvert aux missions' : 'Ne cherche pas'}
        </Badge>
        <Badge tone="neutral">
          <Eye className="h-3 w-3" aria-hidden /> 128 vues
        </Badge>
      </div>

      {editing ? (
        <Card className="flex flex-col gap-3">
          <Input
            label="Accroche"
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            maxLength={80}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">
              À propos
            </span>
            <textarea
              value={about}
              onChange={(event) => setAbout(event.target.value)}
              rows={4}
              maxLength={500}
              className="rounded-token border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink focus-visible:border-accent focus-visible:outline-none"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">
              Compétences
            </span>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold"
                >
                  {skill}
                  <button
                    type="button"
                    aria-label={`Retirer ${skill}`}
                    onClick={() => setSkills((current) => current.filter((item) => item !== skill))}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Ajouter une compétence"
                  value={newSkill}
                  onChange={(event) => setNewSkill(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Béton armé…"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addSkill}
                aria-label="Ajouter la compétence"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <Button
            variant={openToWork ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setOpenToWork((value) => !value)}
          >
            {openToWork ? 'Ouvert aux missions' : 'Ne pas chercher'}
          </Button>

          <Button block onClick={save}>
            <Check className="h-4 w-4" aria-hidden /> Enregistrer
          </Button>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold">Compétences</h2>
              <span className="text-[11px] text-muted">
                {endorsed.length} recommandation(s) reçue(s)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => {
                const hasEndorsed = endorsed.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    aria-pressed={hasEndorsed}
                    aria-label={`Recommander la compétence ${skill}`}
                    onClick={() =>
                      setEndorsed((current) =>
                        hasEndorsed
                          ? current.filter((item) => item !== skill)
                          : [...current, skill],
                      )
                    }
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${
                      hasEndorsed ? 'border-accent text-accent-text' : 'border-line text-ink'
                    }`}
                  >
                    {skill}
                    <span className="font-mono text-[10px] text-muted">{hasEndorsed ? 1 : 0}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted">
              Recommander ne change pas ton classement : c’est un signal de confiance, jamais un
              achat ni un score public.
            </p>
          </Card>

          <Card className="flex flex-col gap-2">
            <h2 className="font-display text-sm font-bold">À propos</h2>
            <p className="text-sm text-muted">{about}</p>
          </Card>
        </>
      )}

      <p role="status" aria-live="polite" className={status ? 'text-xs text-ok' : 'sr-only'}>
        {status}
      </p>

      <Hint>
        Les coordonnées privées ne sont jamais affichées sans accord mutuel. Les recommandations de
        compétences viennent des relations, jamais d’un achat.
      </Hint>
    </div>
  );
}
