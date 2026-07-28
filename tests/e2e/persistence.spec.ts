import { expect, test } from '@playwright/test';
import { cardByTitle, openScriptInPrompter, prompterOffset } from './helpers';

test('scripts and settings persist while reading position resets', async ({ page }) => {
  await page.goto('/');

  // Crear un guion.
  await page.getByTestId('new-script').click();
  await page.getByTestId('editor-title').fill('Persistente');
  await page.getByTestId('editor-content').fill('Contenido que debe sobrevivir.');
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  await page.getByTestId('editor-close').click();
  await expect(cardByTitle(page, 'Persistente')).toBeVisible();

  // Cambiar un ajuste desde el prompter.
  await openScriptInPrompter(page, 'Welcome to Teleprompter');
  await page.getByTestId('settings-toggle').click();
  await page.getByTestId('font-plus').click();
  await expect(page.getByTestId('font-value')).toHaveText('62px');
  await page.getByTestId('settings-close').click();

  // Advance, then leave the reader.
  await page.getByTestId('play-pause').click();
  await page.waitForTimeout(800);
  await page.getByTestId('play-pause').click();
  const position = await prompterOffset(page);
  expect(position).toBeGreaterThan(0);
  await page.getByTestId('back-to-scripts').click();
  // Settings are flushed before the navigation reaches #/.
  await expect(page.getByTestId('new-script')).toBeVisible();

  // Recargar: todo debe seguir ahí.
  await page.reload();
  await expect(cardByTitle(page, 'Persistente')).toBeVisible();

  await openScriptInPrompter(page, 'Welcome to Teleprompter');
  await page.getByTestId('settings-toggle').click();
  await expect(page.getByTestId('font-value')).toHaveText('62px');
  await page.getByTestId('settings-close').click();

  // Opening the script again always begins at the start.
  const restored = await prompterOffset(page);
  expect(restored).toBe(0);
});

test('a setting changed immediately before leaving is persisted', async ({ page }) => {
  await page.goto('/');
  await openScriptInPrompter(page, 'Welcome to Teleprompter');
  await page.getByTestId('settings-toggle').click();
  await page.getByTestId('font-plus').click();
  await page.getByTestId('settings-close').click();
  await page.getByTestId('back-to-scripts').click();
  await expect(page.getByTestId('new-script')).toBeVisible();

  await openScriptInPrompter(page, 'Welcome to Teleprompter');
  await page.getByTestId('settings-toggle').click();
  await expect(page.getByTestId('font-value')).toHaveText('62px');
});
