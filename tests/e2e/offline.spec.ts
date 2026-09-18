import { expect, test } from '@playwright/test';
import { cardByTitle, createScriptFixture } from './helpers';

test('an installed app reopens its local library and reader without a network', async ({
  page,
  context,
  browserName
}) => {
  test.skip(browserName !== 'chromium', 'This test needs reliable service worker control in CI.');
  await page.goto('/');
  await createScriptFixture(page, 'Offline script', '# Offline section\n\nThis is stored here.');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(cardByTitle(page, 'Offline script')).toBeVisible();
    await cardByTitle(page, 'Offline script').getByTestId('open-prompter').click();
    await expect(page.getByTestId('prompter-page')).toBeVisible();
    await expect(page.getByText('This is stored here.')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
