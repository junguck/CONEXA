import { describe, expect, it } from 'vitest';

import { filterMessage, rejectionMessage } from './chat-filter';

describe('filterMessage', () => {
  it('laisse passer une phrase normale', () => {
    expect(filterMessage('Je serai devant le restaurant en avance').blocked).toBe(false);
    expect(filterMessage('On se retrouve près de la table ?').blocked).toBe(false);
  });

  it('relègue les chiffres, même Unicode', () => {
    expect(filterMessage('Mon numéro est 691234567').reasons).toContain('chiffres');
    expect(filterMessage('code ٦٩١٢٣٤').reasons).toContain('chiffres');
  });

  it('détecte les liens, pseudos et demandes de contact', () => {
    expect(filterMessage('écris sur https://example.com').reasons).toContain('lien');
    expect(filterMessage('retrouve-moi sur @brice').reasons).toContain('pseudo');
    expect(filterMessage('donne ton WhatsApp').reasons).toContain('demande de contact');
  });

  it('détecte un numéro épelé', () => {
    expect(filterMessage('zéro six neuf un deux').reasons).toContain('nombre en lettres');
    expect(filterMessage('un deux trois quatre').reasons).toContain('nombre en lettres');
    expect(filterMessage('un seul suffit').blocked).toBe(false);
  });

  it('explique le refus', () => {
    const result = filterMessage('appelle-moi au 691234567');
    expect(result.blocked).toBe(true);
    expect(rejectionMessage(result.reasons)).toContain('Message non envoyé');
  });
});
