import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EventModal from '../src/components/EventModal';
import type { Friend, Group } from '../src/types';

const friends: Friend[] = [
  { id: 'friend_anna', name: 'Anna', phoneNumber: '+491511111111' },
  { id: 'friend_tom', name: 'Tom', phoneNumber: '+491522222222' },
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

describe('EventModal critical flows', () => {
  it('builds a clean event payload from minimal taps', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EventModal
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        groups={groups}
        friends={friends}
      />,
    );

    const nextButton = screen.getByRole('button', { name: /Weiter/i });
    expect(nextButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/Pizza Abend/i), '  Beach Jam  ');

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-08-10' } });
    fireEvent.change(timeInput, { target: { value: '18:45' } });

    expect(nextButton).toBeEnabled();
    await user.click(nextButton);

    await user.type(screen.getByPlaceholderText(/Hauptstraße 1/i), '  Stadtpark  ');
    await user.click(screen.getByRole('button', { name: /Crew Squad/i }));
    await user.click(screen.getByRole('button', { name: /Push-Reminder/i }));
    expect(screen.getByText('AUS')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    expect(screen.getByText(/Wer kommt/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Name (optional)'), '  Jo  ');
    await user.type(screen.getByPlaceholderText('+49 123 456789'), '  +49111111111  ');
    await user.click(screen.getByRole('button', { name: /^\+$/ }));

    await user.click(screen.getByRole('button', { name: /Anna \+491511111111/i }));
    await user.click(screen.getByRole('button', { name: /Anna \+491511111111/i }));
    expect(screen.getByText(/Ausgewählte Teilnehmer \(1\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Event erstellen/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    const payload = onCreate.mock.calls[0][0];
    expect(payload.title).toBe('Beach Jam');
    expect(payload.time).toBe('18:45');
    expect(payload.location).toBe('Stadtpark');
    expect(payload.reminderEnabled).toBe(false);
    expect(payload.rsvpDeadline).toBeUndefined();
    expect(payload.groupIds).toEqual(['group_crew']);
    expect(payload.participants).toEqual([
      expect.objectContaining({
        name: 'Jo',
        phoneNumber: '+49111111111',
      }),
    ]);
    expect(payload.date).toBeInstanceOf(Date);
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('resets progress when closed to avoid stale data', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <EventModal
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        groups={groups}
        friends={friends}
      />,
    );

    await user.type(screen.getByPlaceholderText(/Pizza Abend/i), 'Test Event');
    const backdrop = container.querySelector('div.absolute.inset-0') as HTMLDivElement;
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Schritt 1/3')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Pizza Abend/i)).toHaveValue('');
  });

  it('ignores incomplete manual participants to prevent ghost attendees', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EventModal
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        groups={groups}
        friends={friends}
      />,
    );

    await user.type(screen.getByPlaceholderText(/Pizza Abend/i), 'Guardrail Event');
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-09-21' } });
    fireEvent.change(timeInput, { target: { value: '20:00' } });

    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /Weiter/i }));

    await user.type(screen.getByPlaceholderText('Name (optional)'), 'Leerer Kontakt');
    await user.click(screen.getByRole('button', { name: /^\+$/ }));

    expect(screen.queryByText(/Ausgewählte Teilnehmer/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Event erstellen/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    expect(onCreate.mock.calls[0][0].participants).toEqual([]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses "Kontakt" when adding a phone-only participant', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EventModal
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        groups={groups}
        friends={friends}
      />,
    );

    await user.type(screen.getByPlaceholderText(/Pizza Abend/i), 'Fallback Contact Event');
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-09-23' } });
    fireEvent.change(timeInput, { target: { value: '19:30' } });

    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /Weiter/i }));

    await user.type(screen.getByPlaceholderText('+49 123 456789'), '+491733333333');
    await user.click(screen.getByRole('button', { name: /^\+$/ }));

    expect(screen.getByText(/Ausgewählte Teilnehmer \(1\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kontakt/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Event erstellen/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    expect(onCreate.mock.calls[0][0].participants).toEqual([
      expect.objectContaining({
        name: 'Kontakt',
        phoneNumber: '+491733333333',
      }),
    ]);
  });

  it('removes groups when tapped again to avoid accidental sticky filters', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EventModal
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        groups={groups}
        friends={friends}
      />,
    );

    await user.type(screen.getByPlaceholderText(/Pizza Abend/i), 'Group Toggle Event');
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-09-24' } });
    fireEvent.change(timeInput, { target: { value: '16:00' } });

    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    const groupButton = screen.getByRole('button', { name: /Crew Squad/i });
    await user.click(groupButton);
    await user.click(groupButton);

    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /Event erstellen/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    expect(onCreate.mock.calls[0][0].groupIds).toEqual([]);
  });

  it('sets RSVP deadline presets in event payload', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EventModal
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        groups={groups}
        friends={friends}
      />,
    );

    await user.type(screen.getByPlaceholderText(/Pizza Abend/i), 'Deadline Event');
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-10' } });
    fireEvent.change(timeInput, { target: { value: '18:00' } });

    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /24h vorher/i }));
    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /Event erstellen/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    expect(onCreate.mock.calls[0][0].rsvpDeadline).toEqual(new Date('2026-11-09T18:00'));
  });

  it('supports resetting RSVP deadline to "Keine Deadline"', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EventModal
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        groups={groups}
        friends={friends}
      />,
    );

    await user.type(screen.getByPlaceholderText(/Pizza Abend/i), 'No Deadline Event');
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-11-12' } });
    fireEvent.change(timeInput, { target: { value: '19:00' } });

    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /2h vorher/i }));
    await user.click(screen.getByRole('button', { name: /Keine Deadline/i }));
    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /Event erstellen/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    expect(onCreate.mock.calls[0][0].rsvpDeadline).toBeUndefined();
  });
});
