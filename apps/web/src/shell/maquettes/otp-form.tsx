'use client';

import { Button } from '@conexa/ui';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

const LENGTH = 6;

/** Code WhatsApp à 6 chiffres : saisie, collage, renvoi. Aucun minuteur factice. */
export function OtpForm() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array.from({ length: LENGTH }, () => ''));
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    setDigits((current) => current.map((item, position) => (position === index ? digit : item)));
    if (digit && index < LENGTH - 1) boxes.current[index + 1]?.focus();
    setError('');
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (digits.some((digit) => digit === '')) {
      setError('Saisis les six chiffres du code reçu sur WhatsApp.');
      return;
    }
    router.push('/');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted">
          Code envoyé au <span className="font-mono text-ink">+237 6•• ••• •12</span> sur WhatsApp.
          Il expire au bout de 5 minutes.
        </p>
      </div>

      <fieldset
        className="flex flex-col gap-2"
        onPaste={(event) => {
          const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
          if (pasted === '') return;
          event.preventDefault();
          setDigits(Array.from({ length: LENGTH }, (_, index) => pasted[index] ?? ''));
          boxes.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
        }}
      >
        <legend className="text-[11px] font-semibold uppercase tracking-[.04em] text-muted">
          Code à 6 chiffres
        </legend>
        <div className="flex gap-2">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                boxes.current[index] = element;
              }}
              value={digit}
              onChange={(event) => setDigit(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Backspace' && digit === '' && index > 0) {
                  boxes.current[index - 1]?.focus();
                }
              }}
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              aria-label={`Chiffre ${index + 1} du code`}
              maxLength={1}
              className="h-14 w-full rounded-token border-[1.5px] border-line bg-surface text-center font-mono text-xl font-bold text-ink focus-visible:border-accent focus-visible:outline-none"
            />
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-xs text-ok">
          {status}
        </p>
      ) : null}

      <Button block type="submit">
        Vérifier le code
      </Button>

      <button
        type="button"
        onClick={() => {
          setStatus('Nouveau code envoyé (démo). Le précédent reste valable 5 minutes.');
          setDigits(Array.from({ length: LENGTH }, () => ''));
          boxes.current[0]?.focus();
        }}
        className="min-h-11 text-sm font-semibold text-accent-text"
      >
        Renvoyer le code
      </button>
    </form>
  );
}
