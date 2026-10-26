import Link from 'next/link';

import { OtpForm } from '../../../shell/maquettes/otp-form';

export default function VerifyPage() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-8">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[.16em] text-accent-text">Connexion</p>
        <h1 className="font-display text-3xl font-bold leading-tight">Vérifie ton numéro</h1>
        <p className="text-sm text-muted">
          Pas de mot de passe : le code arrive sur WhatsApp. Ton numéro n’est jamais montré aux
          autres étudiants.
        </p>
      </div>

      <OtpForm />

      <div className="flex flex-col gap-2">
        <Link href="/login" className="text-center text-sm font-semibold text-accent-text">
          Changer de numéro
        </Link>
        <p className="text-xs leading-relaxed text-muted">
          Le code est vérifié par le service Identity. En cas d’erreur répétée, le serveur limite
          les tentatives — la maquette ne simule aucune urgence.
        </p>
      </div>
    </div>
  );
}
