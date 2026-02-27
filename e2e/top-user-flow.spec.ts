import { expect, test } from '@playwright/test';

const MOCK_DATA_STORAGE_KEY = 'social-calendar:mock-data:v1';

function eventDateISO(): string {
  const value = new Date();
  value.setDate(value.getDate() + 2);
  return value.toISOString().slice(0, 10);
}

test('login -> onboarding -> event -> public RSVP -> no-show nudge', async ({ page, context }) => {
  const dialogMessages: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.accept();
  });

  await page.goto('/');
  await expect(page.getByText(/Los geht's!/i)).toBeVisible();

  await page.getByPlaceholder('+49 123 456789').fill('+491700000000');
  await page.getByRole('button', { name: /Code senden/i }).click();
  await expect(page.getByText(/Code eingeben/i)).toBeVisible();

  await page.getByPlaceholder('••••••').fill('123456');
  await page.getByRole('button', { name: /Anmelden/i }).click();

  await expect(page.getByText(/Wer bist du/i)).toBeVisible();
  await page.getByPlaceholder('Dein Name').fill('E2E Alex');
  await page.getByRole('button', { name: /Weiter/i }).click();
  await page.getByRole('button', { name: /Weiter/i }).click();
  await page.locator('input[placeholder="@username"]').first().fill('@e2ealex');
  await page.getByRole('button', { name: /Fertig/i }).click();

  await expect(page.getByText(/kommende Events/i)).toBeVisible();

  const eventTitle = `E2E Hangout ${Date.now().toString().slice(-5)}`;
  await page.getByRole('button', { name: /Neuer Termin/i }).click();
  await page.getByPlaceholder(/Pizza Abend/i).fill(eventTitle);
  await page.locator('input[type="date"]').fill(eventDateISO());
  await page.locator('input[type="time"]').fill('18:30');
  await page.getByRole('button', { name: /Weiter/i }).click();
  await page.getByRole('button', { name: /24h vorher/i }).click();
  await page.getByPlaceholder(/Hauptstraße 1/i).fill('Skaterpark');
  await page.getByRole('button', { name: /Weiter/i }).click();
  await page.getByPlaceholder('Name (optional)').fill('Pending Friend');
  await page.getByPlaceholder('+49 123 456789').fill('+491234560000');
  await page.getByRole('button', { name: /^\+$/ }).click();
  await page.getByRole('button', { name: /Event erstellen/i }).click();

  await expect.poll(() => dialogMessages.some((entry) => entry.includes('Event erstellt'))).toBeTruthy();
  await expect(page.getByText(eventTitle)).toBeVisible();

  const inviteLink = await page.evaluate(({ title, storageKey }) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { events: Array<{ title: string; invitationLink?: string }> };
    const createdEvent = parsed.events.find((entry) => entry.title === title);
    return createdEvent?.invitationLink ?? null;
  }, { title: eventTitle, storageKey: MOCK_DATA_STORAGE_KEY });

  expect(inviteLink).toBeTruthy();

  const inviteePage = await context.newPage();
  await inviteePage.goto(inviteLink as string);
  await expect(inviteePage.getByText(/Du bist eingeladen/i)).toBeVisible();
  await inviteePage.getByPlaceholder('Dein Name').fill('Guest One');
  await inviteePage.getByPlaceholder('Deine Telefonnummer').fill('+491299991111');
  await inviteePage.getByRole('button', { name: /Ich komme!/i }).click();
  await expect(inviteePage.getByText(/Super!|Späte Zusage/i)).toBeVisible();

  const eventCard = page.locator('.card', { hasText: eventTitle }).first();
  await expect(eventCard).toContainText(/ausstehend/i);
  await eventCard.getByRole('button', { name: /Ausstehende erinnern/i }).click();

  await expect.poll(() => dialogMessages.some((entry) => entry.includes('Erinnerungen gesendet'))).toBeTruthy();
  await expect(eventCard).toContainText(/Letzte Erinnerung/i);
});
