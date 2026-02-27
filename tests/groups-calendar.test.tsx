import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Groups from '../src/pages/Groups';
import { renderWithProviders } from './utils/renderWithProviders';
import { seedAuthenticatedUser } from './utils/auth';

describe('groups calendar experience', () => {
  it('shows group-specific events and supports fast group creation', async () => {
    seedAuthenticatedUser({ name: 'Alex', phoneNumber: '+491700000000' });

    renderWithProviders(<Groups />, {
      path: '/groups',
      route: '/groups',
    });

    await screen.findByText('Deine Gruppen');

    const user = userEvent.setup();
    const sportGroupButton = await screen.findByRole('button', { name: /Sportteam/i });
    await user.click(sportGroupButton);

    await screen.findByText('Gruppen-Kalender');
    expect(screen.getByText('Basketball Training')).toBeInTheDocument();
    expect(screen.queryByText('Pizza + Spieleabend')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Zurück zu Gruppen/i }));
    await user.click(screen.getByRole('button', { name: /Neue Gruppe/i }));

    await user.type(screen.getByPlaceholderText('Gruppenname'), 'Abi Orga');
    await user.click(screen.getByRole('button', { name: /Anna/i }));
    await user.type(screen.getByPlaceholderText('Zusätzliche Telefonnummer'), '+491999888777');
    await user.click(screen.getByRole('button', { name: /Gruppe erstellen/i }));

    await waitFor(() => {
      expect(screen.getByText('Abi Orga')).toBeInTheDocument();
    });

    expect(screen.getByText('+491999888777')).toBeInTheDocument();
  });

  it('uses "Du" as fallback name when creating a group with blank profile name', async () => {
    seedAuthenticatedUser({ name: '   ', phoneNumber: '+491700111222' });

    renderWithProviders(<Groups />, {
      path: '/groups',
      route: '/groups',
    });

    await screen.findByText('Deine Gruppen');

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: /Neue Gruppe/i })[0]);
    await user.type(screen.getByPlaceholderText('Gruppenname'), 'Fallback Crew');
    await user.click(screen.getByRole('button', { name: /Gruppe erstellen/i }));

    await waitFor(() => {
      expect(screen.getByText('Fallback Crew')).toBeInTheDocument();
    });

    expect(screen.getByText('Du')).toBeInTheDocument();
    expect(screen.getByText('+491700111222')).toBeInTheDocument();
  });
});
