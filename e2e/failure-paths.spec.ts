import { expect, test } from '@playwright/test';

const MOCK_DATA_STORAGE_KEY = 'social-calendar:mock-data:v1';
const MOCK_FAULTS_STORAGE_KEY = 'social-calendar:mock-faults:v1';

test('shows login rate-limit error and succeeds after retry', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        'auth.sendCode': {
          type: 'rate_limit',
          remaining: 1,
          retryAfterMs: 12_000,
        },
      }),
    );
  }, MOCK_FAULTS_STORAGE_KEY);

  await page.goto('/');
  await page.getByPlaceholder('+49 123 456789').fill('+491700000000');
  await page.getByRole('button', { name: /Code senden/i }).click();

  await expect(page.getByText(/Zu viele Code-Anfragen/i)).toBeVisible();
  await expect(page.getByText(/12s/)).toBeVisible();

  await page.getByRole('button', { name: /Erneut versuchen/i }).click();
  await expect(page.getByText(/Code eingeben/i)).toBeVisible();
});

test('keeps public RSVP actionable after one network failure', async ({ page }) => {
  await page.goto('/');

  await expect
    .poll(async () => {
      return page.evaluate((storageKey) => Boolean(window.localStorage.getItem(storageKey)), MOCK_DATA_STORAGE_KEY);
    })
    .toBe(true);

  const inviteLink = await page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { events: Array<{ invitationLink?: string }> };
    return parsed.events[0]?.invitationLink ?? null;
  }, MOCK_DATA_STORAGE_KEY);

  expect(inviteLink).toBeTruthy();

  await page.evaluate((storageKey) => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        'data.respondToInvitation': {
          type: 'network',
          remaining: 1,
        },
      }),
    );
  }, MOCK_FAULTS_STORAGE_KEY);

  await page.goto(inviteLink as string);
  await page.getByPlaceholder('Dein Name').fill('Retry User');
  await page.getByPlaceholder('Deine Telefonnummer').fill('+491244447777');
  await page.getByRole('button', { name: /Ich komme!/i }).click();

  await expect(page.getByText(/Verbindungsproblemen/i)).toBeVisible();
  await page.getByRole('button', { name: /Erneut versuchen/i }).click();
  await expect(page.getByText(/Super!/i)).toBeVisible();
});
