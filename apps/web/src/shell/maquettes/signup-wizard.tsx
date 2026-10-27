'use client';

import { Badge, Button, Input, Select } from '@conexa/ui';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const FILIERES = [
  { value: 'informatique', label: 'Informatique' },
  { value: 'gestion', label: 'Gestion' },
  { value: 'droit', label: 'Droit' },
  { value: 'medecine', label: 'Médecine' },
  { value: 'genie-civil', label: 'Génie Civil' },
];

const NIVEAUX = [
  { value: 'l1', label: 'Licence 1' },
  { value: 'l2', label: 'Licence 2' },
  { value: 'l3', label: 'Licence 3' },
  { value: 'm1', label: 'Master 1' },
  { value: 'm2', label: 'Master 2' },
];

const STEPS = ['Numéro', 'Profil', 'Justificatif'];

export function SignupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [filiere, setFiliere] = useState('informatique');
  const [niveau, setNiveau] = useState('l1');
  const [matricule, setMatricule] = useState('');
  const [document, setDocument] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');

  function next() {
    setError('');
    if (step === 0) {
      if (phone.replace(/\D/g, '').length < 9) {
        setError('Indique un numéro complet, indicatif compris.');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (firstName.trim() === '' || lastName.trim() === '') {
        setError('Prénom et nom sont nécessaires pour la carte étudiante.');
        return;
      }
      setStep(2);
      return;
    }
    if (!document) {
      setError('Joins une photo lisible de ta carte étudiante.');
      return;
    }
    if (matricule.trim().length < 4) {
      setError('Le matricule doit contenir au moins quatre caractères.');
      return;
    }
    if (!consent) {
      setError('Accepte la charte et la politique de confidentialité pour continuer.');
      return;
    }
    router.push('/pending');
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-5 py-8">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[.16em] text-accent-text">
          Étape {step + 1} sur 3
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">Rejoindre Convexa</h1>
        <p className="text-sm text-muted">
          Ton numéro sert uniquement à recevoir le code WhatsApp. Il n’est jamais montré aux autres
          étudiants.
        </p>
      </div>

      <ol className="flex gap-1.5" aria-label="Progression">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? 'step' : undefined}
            className={`flex-1 border-t-2 pt-1.5 text-[10px] uppercase tracking-[.06em] ${
              index <= step ? 'border-accent text-ink' : 'border-line text-muted'
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <Input
          label="Numéro WhatsApp"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="+237 6…"
          hint="Un code à six chiffres confirmera ce numéro à l’étape suivante."
        />
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-3">
          <Input
            label="Prénom"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
          />
          <Input
            label="Nom"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="family-name"
          />
          <Select label="Filière" value={filiere} onValueChange={setFiliere} options={FILIERES} />
          <Select label="Niveau" value={niveau} onValueChange={setNiveau} options={NIVEAUX} />
          <p className="text-xs text-muted">La photo de profil se règle ensuite dans Moi.</p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3">
          <Input
            label="Matricule étudiant"
            value={matricule}
            onChange={(event) => setMatricule(event.target.value)}
            hint="Visible seulement par l’équipe de validation."
          />
          <button
            type="button"
            aria-pressed={document}
            onClick={() => setDocument((value) => !value)}
            className={`flex min-h-16 items-center justify-between rounded-token border-[1.5px] px-3.5 text-sm font-semibold ${
              document ? 'border-ok text-ok' : 'border-dashed border-line text-muted'
            }`}
          >
            {document ? 'Carte étudiante ajoutée' : 'Ajouter une photo de la carte étudiante'}
            {document ? <Check className="h-5 w-5" aria-hidden /> : null}
          </button>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-5 w-5"
            />
            J’accepte la charte (respect, pas de harcèlement) et la politique de confidentialité.
          </label>
          <Badge tone="neutral">Validation humaine sous 24 h ouvrées</Badge>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        {step > 0 ? (
          <Button variant="ghost" block onClick={() => setStep((value) => value - 1)}>
            Retour
          </Button>
        ) : null}
        <Button block onClick={next}>
          {step === 2 ? 'Envoyer mon dossier' : 'Continuer'}
        </Button>
      </div>

      <p className="text-xs text-muted">
        Maquette : aucune donnée n’est envoyée. Le matricule et la carte ne seront lus que par
        l’équipe de validation, jamais affichés ailleurs.
      </p>
    </div>
  );
}
