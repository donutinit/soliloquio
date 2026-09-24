import { expect, test } from '@playwright/test';
import { cardByTitle, createSampleScript, createSampleScripts } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('starts with only the factory script pinned at the bottom', async ({ page }) => {
  await expect(page.getByTestId('script-card')).toHaveCount(1);
  const factoryCard = cardByTitle(page, 'Read me first');
  await expect(factoryCard.getByTestId('card-title')).toHaveText('Read me first');
  await expect(page.getByTestId('empty-state')).toHaveCount(0);

  await factoryCard.getByTestId('open-prompter').click();
  await expect(page.getByTestId('prompter-page')).toBeVisible();
  await expect(
    page.locator('[data-block-type="heading"]', { hasText: 'Use it as a player' })
  ).toBeVisible();

  await page.getByTestId('back-to-scripts').click();
  await createSampleScripts(page);
  await expect(page.getByTestId('script-card')).toHaveCount(3);
  await expect(page.getByTestId('script-card').last()).toContainText('Read me first');
  await expect(page.getByTestId('script-card').first()).toContainText('Quick notes');
});

test('crea un guion nuevo y lo edita con autosave', async ({ page }) => {
  await page.getByTestId('new-script').click();
  await expect(page.getByTestId('editor-title')).toBeVisible();

  await page.getByTestId('editor-title').fill('Mi guion de prueba');
  await page.getByTestId('editor-content').fill('# Sección uno\n\nTexto del guion.');
  await expect(page.getByTestId('save-status')).toHaveText('Saved');

  await page.getByTestId('editor-close').click();
  await expect(cardByTitle(page, 'Mi guion de prueba')).toBeVisible();
});

test('opening the prompter immediately flushes pending edits', async ({ page }) => {
  await page.getByTestId('new-script').click();
  await page.getByTestId('editor-title').fill('Immediate save');
  await page.getByTestId('editor-content').fill('# Fresh content\n\nThis must not be lost.');
  await page.getByTestId('editor-open-prompter').click();

  await expect(page.getByTestId('prompter-page')).toBeVisible();
  await expect(page.locator('[data-block-type="heading"]')).toHaveText('Fresh content');
  await expect(page.locator('[data-block-type="text"]')).toHaveText('This must not be lost.');
});

test('switching edit routes shows the selected script instead of the previous draft', async ({ page }) => {
  await createSampleScripts(page);
  await cardByTitle(page, 'Quick notes').getByTestId('open-prompter').click();
  const firstHash = await page.evaluate(() => window.location.hash);
  await page.getByTestId('back-to-scripts').click();
  await cardByTitle(page, 'Welcome to Soliloquio').getByTestId('open-prompter').click();
  const secondHash = await page.evaluate(() => window.location.hash);
  await page.getByTestId('back-to-scripts').click();

  await page.evaluate((hash) => {
    window.location.hash = hash.replace('/prompter/', '/edit/');
  }, firstHash);
  await expect(page.getByTestId('editor-title')).toHaveValue('Quick notes');
  await page.evaluate((hash) => {
    window.location.hash = hash.replace('/prompter/', '/edit/');
  }, secondHash);
  await expect(page.getByTestId('editor-title')).toHaveValue('Welcome to Soliloquio');
  await expect(page.getByTestId('editor-content')).toHaveValue(/This sample script/);
});

test('dialogs trap focus and close with Escape', async ({ page }) => {
  await createSampleScript(page, 'Quick notes');
  await cardByTitle(page, 'Quick notes').getByTestId('card-menu').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByTestId('menu-edit')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('busca guiones por título y contenido', async ({ page }) => {
  await createSampleScripts(page);
  await expect(cardByTitle(page, 'Welcome to Soliloquio')).toBeVisible();

  await page.getByTestId('search-input').fill('zzz-sin-resultados');
  await expect(page.getByTestId('empty-state')).toBeVisible();

  await page.getByTestId('search-input').fill('welcome');
  await expect(cardByTitle(page, 'Welcome to Soliloquio')).toBeVisible();
  await expect(cardByTitle(page, 'Quick notes')).toHaveCount(0);
});

test('keeps the compact library composition aligned across phone and desktop widths', async ({
  page
}) => {
  await createSampleScript(page, 'Welcome to Soliloquio');
  await page.setViewportSize({ width: 360, height: 800 });
  const headerActions = await page.getByTestId('library-header-actions').boundingBox();
  expect(headerActions).not.toBeNull();
  if (!headerActions) throw new Error('Library header actions have no bounding box.');
  expect(headerActions.x + headerActions.width).toBeLessThanOrEqual(348.5);

  const mobileCard = await cardByTitle(page, 'Welcome to Soliloquio').boundingBox();
  expect(mobileCard).not.toBeNull();
  if (!mobileCard) throw new Error('Mobile script card has no bounding box.');
  expect(mobileCard.width).toBeGreaterThan(330);

  await page.setViewportSize({ width: 1066, height: 700 });
  const desktopCard = await cardByTitle(page, 'Welcome to Soliloquio').boundingBox();
  expect(desktopCard).not.toBeNull();
  if (!desktopCard) throw new Error('Desktop script card has no bounding box.');
  expect(desktopCard.width).toBeGreaterThan(280);
});

test('shows readable card titles without import or update dates', async ({ page }) => {
  await createSampleScript(page, 'Welcome to Soliloquio');
  const card = cardByTitle(page, 'Welcome to Soliloquio');
  await expect(card.getByTestId('card-title')).toHaveCSS('font-size', '25px');
  await expect(card.getByTestId('open-prompter').locator('span')).toHaveCount(3);
  await expect(card.getByTestId('card-meta')).toHaveText(/^\d+ words · ≈ \d+:\d{2}$/);
});

test('duplica un guion', async ({ page }) => {
  await createSampleScript(page, 'Quick notes');
  await cardByTitle(page, 'Quick notes').getByTestId('card-menu').click();
  await page.getByTestId('menu-duplicate').click();
  await expect(cardByTitle(page, 'Quick notes (copy)')).toBeVisible();
});

test('elimina un guion con confirmación en dos pasos', async ({ page }) => {
  await createSampleScript(page, 'Quick notes');
  await cardByTitle(page, 'Quick notes').getByTestId('card-menu').click();
  await page.getByTestId('menu-delete').click();
  await expect(page.getByTestId('menu-delete')).toHaveText('Delete permanently?');
  await page.getByTestId('menu-delete').click();
  await expect(cardByTitle(page, 'Quick notes')).toHaveCount(0);
});

test('confirms menu actions and offers import and new script when the library is empty', async ({
  page
}) => {
  const factoryCard = cardByTitle(page, 'Read me first');
  await factoryCard.getByTestId('card-menu').click();
  await page.getByTestId('menu-duplicate').click();
  await expect(page.getByRole('status').filter({ hasText: 'Script duplicated.' })).toBeVisible();
  await expect(page.getByTestId('script-card')).toHaveCount(2);

  for (let remaining = 2; remaining > 0; remaining -= 1) {
    await page.getByTestId('card-menu').first().click();
    await page.getByTestId('menu-delete').click();
    await page.getByTestId('menu-delete').click();
    await expect(page.getByTestId('script-card')).toHaveCount(remaining - 1);
  }
  await expect(page.getByRole('status').filter({ hasText: 'Script deleted.' })).toBeVisible();

  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(page.getByTestId('empty-import-input')).toBeAttached();
  await page.getByTestId('empty-new-script').click();
  await page.getByTestId('editor-content').fill('One two three.\n\n> not spoken');
  await expect(page.getByTestId('editor-meta')).toHaveText(/^3 words · ≈ 0:01 at 130 wpm$/);
});
