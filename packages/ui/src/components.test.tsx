import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './avatar';
import { Badge } from './badge';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { Input } from './input';
import { Skeleton } from './skeleton';
import { Table } from './table';

describe('Button', () => {
  it('est un bouton de type button par défaut et accepte un libellé', () => {
    render(<Button>Payer</Button>);
    const button = screen.getByRole('button', { name: 'Payer' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('peut être désactivé', () => {
    render(<Button disabled>Payer</Button>);
    expect(screen.getByRole('button', { name: 'Payer' })).toBeDisabled();
  });
});

describe('Input', () => {
  it('associe le libellé au champ et expose l’erreur', () => {
    render(<Input label="Numéro WhatsApp" error="Numéro invalide" />);
    const input = screen.getByLabelText('Numéro WhatsApp');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Numéro invalide');
  });
});

describe('EmptyState', () => {
  it('affiche un titre de niveau 2 et l’action', () => {
    render(
      <EmptyState
        title="Aucun match"
        description="Les matchs arrivent bientôt."
        action={<a href="/">Retour</a>}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Aucun match' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour' })).toBeInTheDocument();
  });
});

describe('Avatar', () => {
  it('calcule les initiales et annonce le nom', () => {
    render(<Avatar name="Aïcha Nkou" />);
    expect(screen.getByRole('img', { name: 'Aïcha Nkou' })).toHaveTextContent('AN');
  });
});

describe('Badge', () => {
  it('porte toujours un texte, jamais seulement une couleur', () => {
    render(<Badge tone="live">Direct</Badge>);
    expect(screen.getByText('Direct')).toBeVisible();
  });
});

describe('Table', () => {
  it('affiche la légende et le message vide', () => {
    render(
      <Table
        caption="Classement du campus"
        columns={[{ key: 'name', header: 'Équipe' }]}
        rows={[]}
        empty="Aucune équipe classée."
      />,
    );
    expect(screen.getByRole('table', { name: 'Classement du campus' })).toBeInTheDocument();
    expect(screen.getByText('Aucune équipe classée.')).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('expose un statut lisible', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement');
  });
});
