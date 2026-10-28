'use client';

import { BriefcaseBusiness, Heart, Trophy, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { t } from '../i18n';

interface NavSlot {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

const FOOT: NavSlot = {
  href: '/football',
  label: t('nav.football'),
  icon: Trophy,
  match: (pathname) => pathname.startsWith('/football'),
};
const MEET: NavSlot = {
  href: '/meet',
  label: t('nav.meet'),
  icon: Heart,
  match: (pathname) => pathname.startsWith('/meet'),
};
const PRO: NavSlot = {
  href: '/pro',
  label: t('nav.pro'),
  icon: BriefcaseBusiness,
  match: (pathname) => pathname.startsWith('/pro'),
};
const ME: NavSlot = {
  href: '/me',
  label: t('nav.me'),
  icon: UserRound,
  match: (pathname) => pathname.startsWith('/me'),
};

/**
 * Barre basse de la maquette (DESIGN_HANDOFF.md §1) : Foot, Meet, CXA (surélevé),
 * Pro, Moi. L'accent suit l'univers actif, toutes les zones font 44 px.
 */
export function BottomNav() {
  const pathname = usePathname();
  const homeActive = pathname === '/' || pathname === '/design';

  return (
    <nav
      aria-label={t('nav.primaryLabel')}
      className="sticky bottom-0 z-30 flex w-full items-stretch border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      {[FOOT, MEET].map((slot) => (
        <SlotLink key={slot.href} slot={slot} active={slot.match(pathname)} />
      ))}

      <Link
        href="/"
        aria-label={`${t('nav.home')} : accueil`}
        aria-current={homeActive ? 'page' : undefined}
        className="relative flex min-h-11 flex-1 flex-col items-center justify-end pb-2.5"
      >
        <span className="mt-[-26px] flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-[#07070A] shadow-[0_0_0_3px_var(--surf),0_6px_18px_rgba(0,0,0,.35)]">
          <img
            src="/brand/glyph-x-dark.png"
            alt=""
            width={34}
            height={34}
            className="h-[34px] w-[34px] object-contain"
          />
        </span>
        <span
          className={`mt-1 text-[11px] font-bold tracking-[.02em] ${homeActive ? 'text-accent-text' : 'text-muted'}`}
        >
          {t('nav.home')}
        </span>
      </Link>

      {[PRO, ME].map((slot) => (
        <SlotLink key={slot.href} slot={slot} active={slot.match(pathname)} />
      ))}
    </nav>
  );
}

function SlotLink({ slot, active }: { slot: NavSlot; active: boolean }) {
  const Icon = slot.icon;
  return (
    <Link
      href={slot.href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 pb-2.5 pt-2 text-[11px] font-bold tracking-[.02em] ${
        active ? 'text-accent-text' : 'text-muted'
      }`}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-x-[22%] top-0 h-[3px] animate-grow rounded-b-[3px] bg-accent"
        />
      ) : null}
      <Icon className="h-[22px] w-[22px]" aria-hidden strokeWidth={2} />
      {slot.label}
    </Link>
  );
}
