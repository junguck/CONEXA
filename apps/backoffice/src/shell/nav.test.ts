import { describe, expect, it } from 'vitest';

import { isActive, sections } from './nav';

describe('sections du back-office', () => {
  it('active la racine uniquement sur elle-même', () => {
    const root = sections[0];
    expect(root).toBeDefined();
    if (!root) return;
    expect(isActive('/', root)).toBe(true);
    expect(isActive('/litiges', root)).toBe(false);
  });

  it('active une section sur ses sous-pages', () => {
    const disputes = sections.find((section) => section.href === '/litiges');
    expect(disputes).toBeDefined();
    if (!disputes) return;
    expect(isActive('/litiges', disputes)).toBe(true);
    expect(isActive('/litiges/42', disputes)).toBe(true);
    expect(isActive('/finance', disputes)).toBe(false);
  });

  it('ajoute le domaine de démonstration depuis le registre', () => {
    expect(sections.some((section) => section.href === '/demo')).toBe(true);
  });
});
