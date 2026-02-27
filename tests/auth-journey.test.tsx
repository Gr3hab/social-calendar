import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { AppProvider } from '../src/context/AppContext';
import { AuthProvider } from '../src/context/AuthContext';
import Login from '../src/pages/Login';

function renderLoginOnly() {
  return render(
    <AppProvider>
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    </AppProvider>,
  );
}

describe('auth journey', () => {
  it('keeps users on the phone step when the number is invalid', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/Los geht's!/i);
    await user.type(screen.getByPlaceholderText(/\+49 123 456789/i), '12345');
    await user.click(screen.getByRole('button', { name: /Code senden/i }));

    expect(await screen.findByText(/gültige Telefonnummer/i)).toBeInTheDocument();
    expect(screen.queryByText(/Code eingeben/i)).not.toBeInTheDocument();
  });

  it('supports aborting code entry and returning to phone input', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/Los geht's!/i);
    await user.type(screen.getByPlaceholderText(/\+49 123 456789/i), '+491700000000');
    await user.click(screen.getByRole('button', { name: /Code senden/i }));

    await screen.findByText(/Code eingeben/i);
    await user.type(screen.getByPlaceholderText('••••••'), '123');
    await user.click(screen.getByRole('button', { name: /Zurück/i }));

    expect(await screen.findByText(/Los geht's!/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/\+49 123 456789/i)).toHaveValue('+491700000000');
    expect(screen.queryByPlaceholderText('••••••')).not.toBeInTheDocument();
  });

  it('shows loading feedback and an error for an invalid 6-digit code', async () => {
    const user = userEvent.setup();
    renderLoginOnly();

    await screen.findByText(/Los geht's!/i);
    await user.type(screen.getByPlaceholderText(/\+49 123 456789/i), '+491700000000');
    await user.click(screen.getByRole('button', { name: /Code senden/i }));

    await screen.findByText(/Code eingeben/i);
    await user.type(screen.getByPlaceholderText('••••••'), '000000');
    await user.click(screen.getByRole('button', { name: /Anmelden/i }));

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    expect(await screen.findByText(/Ungültiger Code/i)).toBeInTheDocument();
  });

  it('moves from phone login to onboarding with minimal friction', async () => {
    const user = userEvent.setup();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Los geht's!/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/\+49 123 456789/i), '+491700000000');
    await user.click(screen.getByRole('button', { name: /Code senden/i }));

    await waitFor(() => {
      expect(screen.getByText(/Code eingeben/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    await user.type(screen.getByPlaceholderText('••••••'), '123456');
    await user.click(screen.getByRole('button', { name: /Anmelden/i }));

    await waitFor(() => {
      expect(screen.getByText(/Wer bist du/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  }, 10000);
});
