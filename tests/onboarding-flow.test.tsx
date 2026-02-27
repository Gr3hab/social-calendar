import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../src/context/AppContext';
import { AuthProvider } from '../src/context/AuthContext';
import Onboarding from '../src/pages/Onboarding';
import type { User } from '../src/types';

function renderOnboardingWithUser(overrides: Partial<User> = {}) {
  const user: User = {
    id: 'self',
    name: '',
    phoneNumber: '+491700000000',
    createdAt: new Date(),
    ...overrides,
  };

  window.localStorage.setItem('user', JSON.stringify(user));

  return render(
    <AppProvider>
      <AuthProvider>
        <MemoryRouter>
          <Onboarding />
        </MemoryRouter>
      </AuthProvider>
    </AppProvider>,
  );
}

describe('Onboarding critical flows', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists name, socials and avatar interactions', async () => {
    class MockFileReader {
      public result: string | ArrayBuffer | null = null;

      public onloadend: null | (() => void) = null;

      public readAsDataURL() {
        this.result = 'data:image/png;base64,mock-avatar';
        if (this.onloadend) {
          this.onloadend();
        }
      }
    }

    vi.stubGlobal('FileReader', MockFileReader);

    const user = userEvent.setup();
    const { container } = renderOnboardingWithUser();

    const nextButton = await screen.findByRole('button', { name: /Weiter/i });
    expect(nextButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Dein Name'), 'Sina');
    expect(nextButton).toBeEnabled();
    await user.click(nextButton);

    expect(await screen.findByText(/Profilbild/i)).toBeInTheDocument();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByAltText('Avatar')).toBeInTheDocument();
    });

    const iconButtons = screen.getAllByRole('button').filter((button) => !button.textContent?.trim());
    await user.click(iconButtons[0]);
    expect(screen.getByText(/Foto wählen/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    expect(await screen.findByText(/Socials/i)).toBeInTheDocument();

    const socialInputs = screen.getAllByPlaceholderText('@username');
    await user.type(socialInputs[0], '@sina.gram');
    await user.type(socialInputs[1], '@sina.snap');
    await user.type(socialInputs[2], '@sina.tok');

    await user.click(screen.getByRole('button', { name: /Fertig/i }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('user') ?? '{}');
      expect(stored.name).toBe('Sina');
      expect(stored.avatar).toBe('');
      expect(stored.socialHandles).toMatchObject({
        instagram: '@sina.gram',
        snapchat: '@sina.snap',
        tiktok: '@sina.tok',
      });
    });
  });

  it('supports back/skip without forcing social handles', async () => {
    const user = userEvent.setup();
    renderOnboardingWithUser({ phoneNumber: '+491700111111' });

    await user.type(await screen.findByPlaceholderText('Dein Name'), 'Leo');
    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /Zurück/i }));

    expect(screen.getByPlaceholderText('Dein Name')).toHaveValue('Leo');

    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /Weiter/i }));
    await user.click(screen.getByRole('button', { name: /Überspringen/i }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('user') ?? '{}');
      expect(stored.name).toBe('Leo');
      expect(stored.socialHandles).toEqual({});
    });
  });
});
