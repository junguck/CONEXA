'use client';

import { Button, Card, Input, Skeleton } from '@conexa/ui';
import type { QuestionnaireBlock } from '@conexa/contracts';
import { useEffect, useState } from 'react';

import { Hint, TopBar } from '../../../shell/maquettes/kit';
import { datingApi } from '../api';
import { useAsync } from '../use-async';

type Answers = Record<string, string | number>;

function emptyAnswers(blocks: QuestionnaireBlock[]): Answers {
  const answers: Answers = {};
  for (const block of blocks) {
    for (const question of block.questions) {
      answers[question.key] = question.kind === 'scale' ? 3 : (question.options?.[0] ?? '');
    }
  }
  return answers;
}

/**
 * Questionnaire fermé : chaque question est un choix ou une note de 1 à 5.
 * Aucun texte libre, donc aucun texte à fuiter. Les préférences d'âge et de
 * genre restent modifiables ; l'enregistrement émet une demande d'embedding si
 * les réponses changent.
 */
export function ProfileScreen() {
  const questions = useAsync(() => datingApi.questions(), []);
  const profile = useAsync(() => datingApi.profile().catch(() => null), []);

  const [birthDate, setBirthDate] = useState('');
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(30);
  const [seeking, setSeeking] = useState<string[]>(['female']);
  const [answers, setAnswers] = useState<Answers>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (questions.data) {
      setAnswers((current) =>
        Object.keys(current).length > 0 ? current : emptyAnswers(questions.data!.blocks),
      );
    }
  }, [questions.data]);

  useEffect(() => {
    if (!profile.data) return;
    setAnswers((current) => ({ ...current, ...profile.data!.answers }));
    setSeeking(profile.data.seeking);
    setAgeMin(profile.data.age_min);
    setAgeMax(profile.data.age_max);
  }, [profile.data]);

  if (questions.loading) return <Skeleton className="h-64 w-full" />;

  if (questions.error || !questions.data) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <TopBar title="Mon profil" back="/meet" />
        <Card>
          <p className="font-display text-base font-bold">Questionnaire indisponible</p>
          <p className="mt-1 text-sm text-muted">Réessaie plus tard ({questions.error}).</p>
        </Card>
      </div>
    );
  }

  const blocks = questions.data.blocks;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await datingApi.saveProfile({
        birth_date: birthDate,
        questionnaire_v: questions.data!.version,
        answers,
        seeking: seeking as Array<'female' | 'male' | 'other'>,
        age_min: ageMin,
        age_max: ageMax,
      });
      setMessage('Profil enregistré. Les vecteurs sont recalculés si tes réponses changent.');
      profile.reload();
    } catch (cause) {
      setMessage(cause instanceof Error && 'code' in cause ? String(cause.code) : 'NETWORK_ERROR');
    } finally {
      setSaving(false);
    }
  }

  const toggleSeeking = (value: string) =>
    setSeeking((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Mon profil"
        back="/meet"
        eyebrow={profile.data ? 'Profil existant' : 'Premier questionnaire'}
      />

      <Card className="flex flex-col gap-3">
        <Input
          label="Date de naissance"
          type="date"
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
        />
        <p className="text-xs text-muted">
          18 ans révolus exigés. Le module est fermé aux mineurs.
        </p>

        <div className="flex flex-col gap-1 text-sm font-semibold">
          Je souhaite rencontrer
          <div className="flex gap-1.5">
            {[
              { value: 'female', label: 'Femmes' },
              { value: 'male', label: 'Hommes' },
              { value: 'other', label: 'Autres' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={seeking.includes(option.value)}
                onClick={() => toggleSeeking(option.value)}
                className={`min-h-11 flex-1 rounded-full border text-xs font-semibold ${
                  seeking.includes(option.value)
                    ? 'border-accent text-accent-text'
                    : 'border-line text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              label="Âge minimum"
              type="number"
              min={18}
              max={99}
              value={ageMin}
              onChange={(event) => setAgeMin(Number(event.target.value))}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Âge maximum"
              type="number"
              min={18}
              max={99}
              value={ageMax}
              onChange={(event) => setAgeMax(Number(event.target.value))}
            />
          </div>
        </div>
      </Card>

      {blocks.map((block) => (
        <Card key={block.key} className="flex flex-col gap-3">
          <p className="font-display text-sm font-bold capitalize">{block.key}</p>
          {block.questions.map((question) => (
            <div key={question.key} className="flex flex-col gap-1">
              <p className="text-sm text-ink">{question.label}</p>
              {question.kind === 'scale' ? (
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={answers[question.key] === value}
                      aria-label={`${value} sur 5`}
                      onClick={() =>
                        setAnswers((current) => ({ ...current, [question.key]: value }))
                      }
                      className={`h-10 flex-1 rounded-token border text-sm font-bold ${
                        answers[question.key] === value
                          ? 'border-accent bg-accent text-accent-ink'
                          : 'border-line text-muted'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(question.options ?? []).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={answers[question.key] === option}
                      onClick={() =>
                        setAnswers((current) => ({ ...current, [question.key]: option }))
                      }
                      className={`min-h-11 rounded-full border px-3 text-xs font-semibold ${
                        answers[question.key] === option
                          ? 'border-accent text-accent-text'
                          : 'border-line text-ink'
                      }`}
                    >
                      {question.labels?.[option] ?? option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      ))}

      {message ? <Hint>{message}</Hint> : null}

      <Button block disabled={saving || !birthDate} onClick={() => void save()}>
        Enregistrer mon profil
      </Button>
      <Hint>
        Les réponses sont fermées : aucun texte libre, donc aucun numéro ni adresse ne peut être
        transmis.
      </Hint>
    </div>
  );
}
