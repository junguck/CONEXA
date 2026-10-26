import type { MatchEvent } from '@conexa/contracts';

export interface ReportSnapshot {
  score_a: number;
  score_b: number;
  events: MatchEvent[];
}

export type Reconciliation = 'validated' | 'disputed';

function eventKey(event: MatchEvent): string {
  return [event.type, event.minute, event.player_id, event.related_player_id ?? ''].join('|');
}

/** Deux déclarations concordent si le score et l'ensemble des faits sont identiques. */
export function reportsAgree(a: ReportSnapshot, b: ReportSnapshot): boolean {
  if (a.score_a !== b.score_a || a.score_b !== b.score_b) {
    return false;
  }
  if (a.events.length !== b.events.length) {
    return false;
  }
  const left = a.events.map(eventKey).sort();
  const right = b.events.map(eventKey).sort();
  return left.every((key, index) => key === right[index]);
}

export function reconcile(a: ReportSnapshot, b: ReportSnapshot): Reconciliation {
  return reportsAgree(a, b) ? 'validated' : 'disputed';
}

/** Le premier rapport (validé) sert de source pour les statistiques. */
export function aggregateEvents(events: MatchEvent[]): {
  goals: Map<string, number>;
  assists: Map<string, number>;
  cards: Map<string, { yellow: number; red: number }>;
} {
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  const cards = new Map<string, { yellow: number; red: number }>();

  for (const event of events) {
    switch (event.type) {
      case 'goal':
        goals.set(event.player_id, (goals.get(event.player_id) ?? 0) + 1);
        if (event.related_player_id) {
          assists.set(event.related_player_id, (assists.get(event.related_player_id) ?? 0) + 1);
        }
        break;
      case 'assist':
        assists.set(event.player_id, (assists.get(event.player_id) ?? 0) + 1);
        break;
      case 'yellow_card':
      case 'red_card': {
        const current = cards.get(event.player_id) ?? { yellow: 0, red: 0 };
        if (event.type === 'yellow_card') {
          current.yellow += 1;
        } else {
          current.red += 1;
        }
        cards.set(event.player_id, current);
        break;
      }
      default:
        break;
    }
  }

  return { goals, assists, cards };
}

/** Badges gagnés au coup d'envoi et au coup de sifflet final. */
export function badgesForMatch(player: {
  goals: number;
  assists: number;
  firstMatch: boolean;
}): string[] {
  const badges: string[] = [];
  if (player.firstMatch) {
    badges.push('first_match');
  }
  if (player.goals >= 3) {
    badges.push('hat_trick');
  }
  if (player.assists >= 3) {
    badges.push('playmaker');
  }
  return badges;
}
