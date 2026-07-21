import { expect, test } from '@playwright/test';
import { cardByTitle, openScriptInPrompter, prompterOffset } from './helpers';

test('guiones, ajustes y posición sobreviven a recargar la página', async ({ page }) => {
  await page.goto('/');

  // Crear un guion.
  await page.getByTestId('new-script').click();
  await page.getByTestId('editor-title').fill('Persistente');
  await page.getByTestId('editor-content').fill('Contenido que debe sobrevivir.');
  await expect(page.getByTestId('save-status')).toHaveText('Guardado');
  await page.getByTestId('editor-close').click();
  await expect(cardByTitle(page, 'Persistente')).toBeVisible();

  // Cambiar un ajuste desde el prompter.
  await openScriptInPrompter(page, 'Bienvenida al teleprompter');
  await page.getByTestId('settings-toggle').click();
  await page.getByTestId('font-plus').click();
  await expect(page.getByTestId('font-value')).toHaveText('46px');
  await page.getByTestId('settings-close').click();

  // Avanzar y volver a la lista (guarda la posición).
  await page.getByTestId('play-pause').click();
  await page.waitForTimeout(800);
  await page.getByTestId('play-pause').click();
  const position = await prompterOffset(page);
  expect(position).toBeGreaterThan(0);
  await page.getByTestId('back-to-scripts').click();
  // Esperar a que la navegación (async tras guardar posición) llegue a #/.
  await expect(page.getByTestId('new-script')).toBeVisible();

  // Recargar: todo debe seguir ahí.
  await page.reload();
  await expect(cardByTitle(page, 'Persistente')).toBeVisible();

  await openScriptInPrompter(page, 'Bienvenida al teleprompter');
  await page.getByTestId('settings-toggle').click();
  await expect(page.getByTestId('font-value')).toHaveText('46px');
  await page.getByTestId('settings-close').click();

  // La posición de lectura se restauró (con tolerancia por redondeo).
  const restored = await prompterOffset(page);
  expect(restored).toBeGreaterThan(position - 5);
});
