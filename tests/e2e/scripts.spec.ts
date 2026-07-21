import { expect, test } from '@playwright/test';
import { cardByTitle } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
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

test('dialogs trap focus and close with Escape', async ({ page }) => {
  await cardByTitle(page, 'Quick notes').getByTestId('card-menu').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByTestId('menu-edit')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('busca guiones por título y contenido', async ({ page }) => {
  await expect(cardByTitle(page, 'Welcome to Teleprompter')).toBeVisible();

  await page.getByTestId('search-input').fill('zzz-sin-resultados');
  await expect(page.getByTestId('empty-state')).toBeVisible();

  await page.getByTestId('search-input').fill('welcome');
  await expect(cardByTitle(page, 'Welcome to Teleprompter')).toBeVisible();
  await expect(cardByTitle(page, 'Quick notes')).toHaveCount(0);
});

test('duplica un guion', async ({ page }) => {
  await cardByTitle(page, 'Quick notes').getByTestId('card-menu').click();
  await page.getByTestId('menu-duplicate').click();
  await expect(cardByTitle(page, 'Quick notes (copy)')).toBeVisible();
});

test('elimina un guion con confirmación en dos pasos', async ({ page }) => {
  await cardByTitle(page, 'Quick notes').getByTestId('card-menu').click();
  await page.getByTestId('menu-delete').click();
  await expect(page.getByTestId('menu-delete')).toHaveText('Delete permanently?');
  await page.getByTestId('menu-delete').click();
  await expect(cardByTitle(page, 'Quick notes')).toHaveCount(0);
});
