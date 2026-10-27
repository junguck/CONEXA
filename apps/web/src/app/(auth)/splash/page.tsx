import Link from 'next/link';

export default function SplashPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10">
      <div className="flex h-32 items-end gap-3.5" aria-label="Convexa">
        <img
          src="/brand/glyph-c-dark.png"
          alt=""
          width={72}
          height={96}
          className="h-24 w-auto animate-rise"
        />
        <img
          src="/brand/glyph-x-dark.png"
          alt=""
          width={72}
          height={96}
          className="h-24 w-auto animate-pop"
        />
        <img
          src="/brand/glyph-a-dark.png"
          alt=""
          width={72}
          height={96}
          className="h-24 w-auto animate-rise"
        />
      </div>

      <div
        className="h-1 w-32 overflow-hidden rounded-full bg-surface2"
        role="progressbar"
        aria-label="Chargement"
      >
        <span className="block h-full w-full origin-left animate-grow bg-accent" />
      </div>

      <Link
        href="/login"
        className="min-h-11 rounded-token px-4 py-2.5 text-sm font-bold text-accent-text"
      >
        Continuer
      </Link>
    </div>
  );
}
