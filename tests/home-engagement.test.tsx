import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import Home from '../src/pages/Home';
import { getMockData, resetMockData } from '../src/services/mockApi';
import { seedAuthenticatedUser } from './utils/auth';
import { renderWithProviders } from './utils/renderWithProviders';

describe('home engagement actions', () => {
  it('shows pending risk badges and allows one-tap nudges for hosts', async () => {
    const mockStorageKey = 'social-calendar:mock-data:v1';
    seedAuthenticatedUser({
      name: 'Alex',
      phoneNumber: '+491700000000',
    });

    await resetMockData();
    const data = await getMockData();
    const targetEvent = data.events[0];

    window.localStorage.setItem(
      mockStorageKey,
      JSON.stringify({
        ...data,
        events: data.events.map((event) =>
          event.id === targetEvent.id
            ? {
                ...event,
                participants: event.participants.map((participant, index) =>
                  index === 0
                    ? { ...participant, isLateResponse: true }
                    : participant,
                ),
              }
            : event,
        ),
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    const eventTitle = await screen.findByText('Pizza + Spieleabend');
    const eventCard = eventTitle.closest('.card') as HTMLElement;

    expect(within(eventCard).getByText(/\d+\s+ausstehend/i)).toBeInTheDocument();
    expect(within(eventCard).getByText(/Späte Antworten enthalten/i)).toBeInTheDocument();

    await user.click(within(eventCard).getByRole('button', { name: /Ausstehende erinnern/i }));
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/Erinnerungen gesendet/));
    });
  });

  it('shows a clear empty state when there are no upcoming events', async () => {
    const mockStorageKey = 'social-calendar:mock-data:v1';
    seedAuthenticatedUser({
      name: 'Alex',
      phoneNumber: '+491700000000',
    });

    await resetMockData();
    const data = await getMockData();
    window.localStorage.setItem(
      mockStorageKey,
      JSON.stringify({ ...data, events: [] }),
    );

    render(<App />);

    expect(await screen.findByText(/Keine Events/i)).toBeInTheDocument();
    expect(screen.getByText(/Erstelle deinen ersten Termin/i)).toBeInTheDocument();
  });

  it('lets users respond, toggle reminders and share links in a few taps', async () => {
    seedAuthenticatedUser({
      name: 'Alex',
      phoneNumber: '+491700000000',
    });

    const user = userEvent.setup();
    render(<App />);

    const eventTitle = await screen.findByText('Pizza + Spieleabend');
    const eventCard = eventTitle.closest('.card') as HTMLElement;

    await user.click(within(eventCard).getByRole('button', { name: /✕ Absage/i }));

    await waitFor(() => {
      expect(within(eventCard).getByText('Absage')).toBeInTheDocument();
    });

    await user.click(within(eventCard).getByRole('button', { name: /Reminder an/i }));
    await waitFor(() => {
      expect(within(eventCard).getByRole('button', { name: /Reminder aus/i })).toBeInTheDocument();
    });

    await user.click(within(eventCard).getByRole('button', { name: /Teilen/i }));
    expect(window.alert).toHaveBeenCalledWith('📋 Einladungslink kopiert');
  });

  it('falls back to pending status and default name for unknown participants', async () => {
    const fallbackPhone = '+491799999111';
    seedAuthenticatedUser({
      name: '   ',
      phoneNumber: fallbackPhone,
    });

    const user = userEvent.setup();
    renderWithProviders(<Home />, {
      path: '/',
      route: '/',
    });

    const eventTitle = await screen.findByText('Pizza + Spieleabend');
    const eventCard = eventTitle.closest('.card') as HTMLElement;

    expect(within(eventCard).getByText('Ausstehend')).toBeInTheDocument();
    await user.click(within(eventCard).getByRole('button', { name: /✓ Zusage/i }));

    await waitFor(async () => {
      const { events } = await getMockData();
      const updated = events
        .find((event) => event.title === 'Pizza + Spieleabend')
        ?.participants.find((participant) => participant.phoneNumber === fallbackPhone);
      expect(updated?.name).toBe('Du');
      expect(updated?.status).toBe('accepted');
    });
  });

  it('hides nudge action when no participant is pending', async () => {
    const mockStorageKey = 'social-calendar:mock-data:v1';
    seedAuthenticatedUser({
      name: 'Alex',
      phoneNumber: '+491700000000',
    });

    await resetMockData();
    const data = await getMockData();
    const targetEvent = data.events[0];

    window.localStorage.setItem(
      mockStorageKey,
      JSON.stringify({
        ...data,
        events: data.events.map((event) =>
          event.id === targetEvent.id
            ? {
                ...event,
                participants: event.participants.map((participant) => ({
                  ...participant,
                  status: 'accepted',
                })),
              }
            : event,
        ),
      }),
    );

    render(<App />);
    const eventTitle = await screen.findByText('Pizza + Spieleabend');
    const eventCard = eventTitle.closest('.card') as HTMLElement;

    expect(within(eventCard).queryByRole('button', { name: /Ausstehende erinnern/i })).not.toBeInTheDocument();
  });
});
