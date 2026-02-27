import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppProvider, appReducer, useApp } from '../src/context/AppContext';
import { authReducer } from '../src/context/AuthContext';
import type { AppState, AuthState } from '../src/types';

function DarkModeHarness() {
  const { dispatch } = useApp();
  return (
    <button onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}>
      Toggle Dark Mode
    </button>
  );
}

describe('context branch guards', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.removeItem('darkMode');
  });

  it('applies the dark class and storage flag when dark mode is enabled', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <DarkModeHarness />
      </AppProvider>,
    );

    await user.click(screen.getByRole('button', { name: /toggle dark mode/i }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
    expect(window.localStorage.getItem('darkMode')).toBe('true');
  });

  it('keeps app state stable for unknown reducer actions', () => {
    const state: AppState = {
      darkMode: false,
      currentView: 'home',
      calendarView: 'month',
      selectedDate: new Date('2026-01-01T00:00:00.000Z'),
    };

    const next = appReducer(state, { type: 'UNKNOWN_ACTION' } as never);
    expect(next).toBe(state);
  });

  it('updates app reducer state for navigation and calendar actions', () => {
    const state: AppState = {
      darkMode: false,
      currentView: 'home',
      calendarView: 'month',
      selectedDate: new Date('2026-01-01T00:00:00.000Z'),
    };

    const withView = appReducer(state, { type: 'SET_CURRENT_VIEW', payload: 'groups' });
    expect(withView.currentView).toBe('groups');

    const withCalendarView = appReducer(withView, { type: 'SET_CALENDAR_VIEW', payload: 'week' });
    expect(withCalendarView.calendarView).toBe('week');

    const selectedDate = new Date('2026-02-02T10:00:00.000Z');
    const withDate = appReducer(withCalendarView, { type: 'SET_SELECTED_DATE', payload: selectedDate });
    expect(withDate.selectedDate).toBe(selectedDate);
  });

  it('covers auth reducer logout, null-update and unknown action guards', () => {
    const base: AuthState = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
    };

    const updatedWithoutUser = authReducer(base, {
      type: 'UPDATE_USER',
      payload: { name: 'No Effect' },
    });
    expect(updatedWithoutUser.user).toBeNull();

    const loggedOut = authReducer(
      {
        user: {
          id: 'u1',
          name: 'Alex',
          phoneNumber: '+491700000000',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        isAuthenticated: true,
        isLoading: false,
      },
      { type: 'LOGOUT' },
    );
    expect(loggedOut).toEqual({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });

    const untouched = authReducer(base, { type: 'UNKNOWN_ACTION' } as never);
    expect(untouched).toBe(base);
  });
});
