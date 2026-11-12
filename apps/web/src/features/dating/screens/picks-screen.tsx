'use client';

import { Badge, Button, Card, EmptyState, Skeleton } from '@conexa/ui';
import Link from 'next/link';
import { useState } from 'react';

import { Hint, TopBar } from '../../../shell/maquettes/kit';
import { datingApi } from '../api';
import { useAsync } from '../use-async';

/**
 * Mes trois propositions de la semaine. Invitation et passage appellent le
 * serveur : le quota de trois invitations reste décidé côté dating, jamais ici.
 */
export function PicksScreen() {
  const { data, error, loading, reload } = useAsync(() => datingApi.picks());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function act(pickId: string, action: 'invite' | 'pass') {
    setBusy(pickId);
    setNotice(null);
    try {
      if (action === 'invite') {
        await datingApi.invite(pickId);
        setNotice('Invitation envoyée. Tu ne verras jamais si elle est refusée.');
      } else {
        await datingApi.pass(pickId);
        setNotice('Proposition passée.');
      }
      reload();
    } catch (cause) {
      setNotice(cause instanceof Error && 'code' in cause ? String(cause.code) : 'NETWORK_ERROR');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 pb-4">
      <TopBar
        title="Meet"
        eyebrow={
          data
            ? `${data.picks.length} proposition(s) · ${data.quota_left} invitation(s) restante(s)`
            : 'Chargement'
        }
      />

      {loading ? <Skeleton className="h-40 w-full" /> : null}

      {error ? (
        error === 'AGE_RESTRICTED' ? (
          <Card>
            <p className="font-display text-base font-bold">Réservé aux majeurs</p>
            <p className="mt-1 text-sm text-muted">
              Le module de rencontres est fermé aux mineurs, sans exception.
            </p>
          </Card>
        ) : error === 'QUESTIONNAIRE_MISSING' || error === 'RELIABILITY_TOO_LOW' ? (
          <Card className="flex flex-col gap-2">
            <p className="font-display text-base font-bold">Complète ton profil</p>
            <p className="text-sm text-muted">
              Un questionnaire rempli et une fiabilité suffisante ouvrent les propositions.
            </p>
            <Button asChild block>
              <Link href="/meet/profil">Ouvrir mon profil</Link>
            </Button>
          </Card>
        ) : (
          <Card>
            <p className="font-display text-base font-bold">Propositions indisponibles</p>
            <p className="mt-1 text-sm text-muted">Réessaie plus tard ({error}).</p>
          </Card>
        )
      ) : null}

      {!loading && !error && data && data.picks.length === 0 ? (
        <EmptyState
          title="Aucune proposition"
          description="Reviens lundi : trois nouvelles propositions."
        />
      ) : null}

      {data?.picks.map((pick) => {
        const decided = pick.decision !== 'none';
        return (
          <Card key={pick.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-base font-bold">{pick.compat_label}</p>
                <p className="text-xs text-muted">
                  {pick.kind === 'complementary' ? 'Profil complémentaire' : 'Profil ressemblant'} ·
                  semaine du {pick.week_start}
                </p>
              </div>
              <Badge tone={pick.kind === 'complementary' ? 'accent' : 'neutral'}>
                {decided ? 'Traitée' : 'Nouvelle'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                block
                disabled={decided || busy === pick.id}
                onClick={() => void act(pick.id, 'invite')}
              >
                Inviter
              </Button>
              <Button
                block
                variant="outline"
                disabled={decided || busy === pick.id}
                onClick={() => void act(pick.id, 'pass')}
              >
                Passer
              </Button>
            </div>
          </Card>
        );
      })}

      {notice ? <Hint>{notice}</Hint> : null}

      <Button asChild variant="outline" block>
        <Link href="/meet/dates">Mes dates et invitations</Link>
      </Button>
    </div>
  );
}
