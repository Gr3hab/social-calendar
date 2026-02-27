import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import EventModal from '../src/components/EventModal';
import PublicEvent from '../src/pages/PublicEvent';
import { clearAllMockFaults, setMockFault } from '../src/services/mockFaults';
import { getMockData, resetMockData } from '../src/services/mockApi';
import { ServiceError } from '../src/services/serviceErrors';
import type { Event, Friend, Group } from '../src/types';
import { seedAuthenticatedUser } from './utils/auth';
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

function buildInviteRoute(event: Event) {
  return `/invite/${event.id}?code=${resolveInviteCode(event)}`;
}

const friends: Friend[] = [
  { id: 'friend_anna', name: 'Anna', phoneNumber: '+491511111111' },
];

const groups: Group[] = [
  {
    id: 'group_crew',
    name: 'Crew Squad',
    description: 'Core group',
    createdBy: 'self',
    members: [{ id: 'self', name: 'Du', phoneNumber: '+491700000000' }],
    createdAt: new Date(),
  },
];

describe('failure resilience', () => {
  it('shows rate-limit guidance and retries send-code successfully', async () => {
    clearAllMockFaults();
    setMockFault('auth.sendCode', {
      type: 'rate_limit',
      remaining: 1,
      retryAfterMs: 15_000,
    });

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/Los geht's!/i);
    await user.type(screen.getByPlaceholderText(/\+49 123 456789/i), '+491700000000');
    await user.click(screen.getByRole('button', { name: /Code senden/i }));

    expect(await screen.findByText(/Zu viele Code-Anfragen/i)).toBeInTheDocument();
    expect(screen.getByText(/15s/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Erneut versuchen/i }));
    expect(await screen.findByText(/Code eingeben/i)).toBeInTheDocument();
  });

  it('keeps EventModal open on network failure and allows retry', async () => {
    clearAllMockFaults();
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreate = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        new ServiceError({
          code: 'NETWORK_ERROR',
          message: 'offline',
        }),
      )
      .mockResolvedValueOnce(undefined);

    render(
      <EventModal
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        groups={groups}
        friends={friends}
      />,
    );

    await user.type(screen.getByPlaceholderText(/Pizza Abend/i), 'Retry Event');
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-08-10' } });
    fireEvent.change(timeInput, { target: { value: '18:45' } });
    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /Weiter/i }));

    await user.click(screen.getByRole('button', { name: /Event erstellen/i }));
    expect(await screen.findByText(/Verbindungsfehler/i)).toBeInTheDocument();
    expect(screen.getByText(/Schritt 3\/3/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Event erstellen/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(2);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps RSVP form usable after one network error and succeeds on retry', async () => {
    clearAllMockFaults();
    setMockFault('data.respondToInvitation', {
      type: 'network',
      remaining: 1,
    });
    await resetMockData();
    const { events } = await getMockData();
    const targetEvent = events[0];

    renderWithProviders(<PublicEvent />, {
      path: '/invite/:eventId',
      route: buildInviteRoute(targetEvent),
    });

    await screen.findByText(targetEvent.title);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Dein Name'), 'Retry Jamie');
    await user.type(screen.getByPlaceholderText('Deine Telefonnummer'), '+49123333555');
    await user.click(screen.getByRole('button', { name: /Ich komme!/i }));

    expect(await screen.findByText(/Verbindungsproblemen/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Erneut versuchen/i }));

    await waitFor(() => {
      expect(screen.getByText(/Super!/i)).toBeInTheDocument();
    });
  });

  it('shows rate-limit feedback when nudge sending is throttled', async () => {
    clearAllMockFaults();
    setMockFault('data.sendRsvpNudge', {
      type: 'rate_limit',
      remaining: 1,
      retryAfterMs: 9_000,
    });
    seedAuthenticatedUser({
      id: 'self',
      name: 'Alex',
      phoneNumber: '+491700000000',
    });
    await resetMockData();

    const user = userEvent.setup();
    render(<App />);

    const eventTitle = await screen.findByText('Pizza + Spieleabend');
    const eventCard = eventTitle.closest('.card') as HTMLElement;
    await user.click(within(eventCard).getByRole('button', { name: /Ausstehende erinnern/i }));

    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/Zu viele Erinnerungen/));
    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/9s/));
  });
});
