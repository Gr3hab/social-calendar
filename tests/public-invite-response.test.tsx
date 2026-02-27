import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PublicEvent from '../src/pages/PublicEvent';
import { getMockData, resetMockData } from '../src/services/mockApi';
import type { Event } from '../src/types';
import { renderWithProviders } from './utils/renderWithProviders';

function resolveInviteCode(event: Event): string {
  if (event.invitationCode) {
    return event.invitationCode;
  }

  const match = event.invitationLink?.match(/[?&]code=([^&]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }

  throw new Error('Missing invitation code for test event');
}

function buildInviteRoute(event: Event, overrideCode?: string) {
  const code = overrideCode ?? resolveInviteCode(event);
  return `/invite/${event.id}?code=${code}`;
}

describe('public invitation response', () => {
  it('shows a clear not-found state for invalid invite links', async () => {
    await resetMockData();

    renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: '/invite/event_missing_404?code=broken',
    });

    expect(await screen.findByText('Event nicht gefunden')).toBeInTheDocument();
    expect(screen.getByText(/abgelaufen oder ungültig/i)).toBeInTheDocument();
  });

  it('blocks RSVP when required identity inputs are missing', async () => {
    await resetMockData();
    const { events } = await getMockData();
    const targetEvent = events[0];

    renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent),
    });

    await screen.findByText(targetEvent.title);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Dein Name'), 'Jamie');
    await user.click(screen.getByRole('button', { name: /Ich komme!/i }));

    expect(window.alert).toHaveBeenCalledWith('Bitte gib eine gültige Telefonnummer ein 📱');
    expect(screen.queryByText(/Super!/i)).not.toBeInTheDocument();
  });

  it('updates existing participants instead of duplicating RSVP entries', async () => {
    await resetMockData();
    const { events } = await getMockData();
    const targetEvent = events[0];

    renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent),
    });

    await screen.findByText(targetEvent.title);
    expect(screen.getByText('Teilnehmer (3)')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Dein Name'), 'Tom Updated');
    await user.type(screen.getByPlaceholderText('Deine Telefonnummer'), '+491522222222');
    await user.click(screen.getByRole('button', { name: /Ich komme!/i }));

    await waitFor(() => {
      expect(screen.getByText(/Super!/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Tom Updated')).toHaveLength(1);
    });

    expect(screen.getByText('Teilnehmer (3)')).toBeInTheDocument();
    expect(screen.queryByText('Tom')).not.toBeInTheDocument();
  });

  it('handles decline responses and shows declined participant state', async () => {
    await resetMockData();
    const { events } = await getMockData();
    const targetEvent = events[0];

    renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent),
    });

    await screen.findByText(targetEvent.title);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Dein Name'), 'Tom Declined');
    await user.type(screen.getByPlaceholderText('Deine Telefonnummer'), '+491522222222');
    await user.click(screen.getByRole('button', { name: /Absagen/i }));

    await waitFor(() => {
      expect(screen.getByText(/Schade!/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Tom Declined')).toBeInTheDocument();
    expect(screen.getByText(/✕ Absage/i)).toBeInTheDocument();
  });

  it('supports whatsapp and copy actions from the share menu', async () => {
    await resetMockData();
    const { events } = await getMockData();
    const targetEvent = events[0];

    const { container } = renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent),
    });

    await screen.findByText(targetEvent.title);

    const user = userEvent.setup();
    const shareButton = container.querySelector('button.absolute.top-4.right-4') as HTMLButtonElement;

    await user.click(shareButton);
    await user.click(screen.getByRole('button', { name: /WhatsApp/i }));
    expect(window.open).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /WhatsApp/i })).not.toBeInTheDocument();

    await user.click(shareButton);
    await user.click(screen.getByRole('button', { name: /Link kopieren/i }));
    expect(window.alert).toHaveBeenCalledWith('📋 Link kopiert');
  });

  it('falls back to current URL when an event has no invitation link', async () => {
    await resetMockData();
    const storageKey = 'social-calendar:mock-data:v1';
    const data = await getMockData();
    const targetEvent = data.events[0];

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...data,
        events: data.events.map((event) =>
          event.id === targetEvent.id
            ? { ...event, invitationLink: undefined }
            : event,
        ),
      }),
    );

    const { container } = renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent),
    });

    await screen.findByText(targetEvent.title);

    const user = userEvent.setup();
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText');
    const shareButton = container.querySelector('button.absolute.top-4.right-4') as HTMLButtonElement;
    await user.click(shareButton);
    await user.click(screen.getByRole('button', { name: /Link kopieren/i }));

    expect(writeSpy).toHaveBeenCalledWith(window.location.href);
  });

  it('allows invitees to accept events and appear in the participant list', async () => {
    await resetMockData();
    const { events } = await getMockData();
    const targetEvent = events[0];

    renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent),
    });

    await screen.findByText(targetEvent.title);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Dein Name'), 'Jamie');
    await user.type(screen.getByPlaceholderText('Deine Telefonnummer'), '+491234009999');
    await user.click(screen.getByRole('button', { name: /Ich komme!/i }));

    await waitFor(() => {
      expect(screen.getByText(/Super!/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Jamie')).toBeInTheDocument();
    });
  });

  it('prefills identity for recurring invitees from local storage', async () => {
    await resetMockData();
    const { events } = await getMockData();
    const targetEvent = events[0];
    window.localStorage.setItem(
      'social-calendar:invite-identity:v1',
      JSON.stringify({ name: 'Nora', phoneNumber: '+491755555555' }),
    );

    renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent),
    });

    await screen.findByText(targetEvent.title);
    expect(screen.getByPlaceholderText('Dein Name')).toHaveValue('Nora');
    expect(screen.getByPlaceholderText('Deine Telefonnummer')).toHaveValue('+491755555555');
  });

  it('rejects valid event ids when invite code is invalid', async () => {
    await resetMockData();
    const { events } = await getMockData();
    const targetEvent = events[0];

    renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent, 'wrong-code'),
    });

    expect(await screen.findByText('Event nicht gefunden')).toBeInTheDocument();
  });

  it('rejects expired invite links', async () => {
    await resetMockData();
    const storageKey = 'social-calendar:mock-data:v1';
    const data = await getMockData();
    const targetEvent = data.events[0];
    const validCode = resolveInviteCode(targetEvent);

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...data,
        events: data.events.map((event) =>
          event.id === targetEvent.id
            ? { ...event, linkExpiresAt: new Date('2020-01-01T00:00:00.000Z') }
            : event,
        ),
      }),
    );

    renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent, validCode),
    });

    expect(await screen.findByText('Event nicht gefunden')).toBeInTheDocument();
  });

  it('labels late responses clearly to reduce no-show confusion', async () => {
    await resetMockData();
    const storageKey = 'social-calendar:mock-data:v1';
    const data = await getMockData();
    const targetEvent = data.events[0];

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...data,
        events: data.events.map((event) =>
          event.id === targetEvent.id
            ? { ...event, rsvpDeadline: new Date('2020-01-01T00:00:00.000Z') }
            : event,
        ),
      }),
    );

    renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent),
    });

    await screen.findByText(targetEvent.title);

    const user = userEvent.setup();
    await user.clear(screen.getByPlaceholderText('Dein Name'));
    await user.type(screen.getByPlaceholderText('Dein Name'), 'Late Jamie');
    await user.clear(screen.getByPlaceholderText('Deine Telefonnummer'));
    await user.type(screen.getByPlaceholderText('Deine Telefonnummer'), '+491266667777');
    await user.click(screen.getByRole('button', { name: /Ich komme!/i }));

    await waitFor(() => {
      expect(screen.queryAllByText(/Späte Zusage/i).length).toBeGreaterThan(0);
    });
  }, 10_000);
});
