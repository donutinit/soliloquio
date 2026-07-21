import { expect, test } from '@playwright/test';
import { installFakeGamepad, openScriptInPrompter, prompterOffset, setButton } from './helpers';

const CROSS = 0;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeGamepad);
  await page.goto('/');
  await openScriptInPrompter(page, 'Welcome to Teleprompter');
});

test('detecta el mando simulado', async ({ page }) => {
  await expect(page.getByTestId('gamepad-status')).toHaveAttribute('data-connected', 'true');
});

test('pulsación corta de Cross alterna play/pausa', async ({ page }) => {
  const playButton = page.getByTestId('play-pause');
  await expect(playButton).toHaveAttribute('data-playing', 'false');

  await setButton(page, CROSS, true);
  await page.waitForTimeout(120);
  await setButton(page, CROSS, false);
  await expect(playButton).toHaveAttribute('data-playing', 'true');

  await setButton(page, CROSS, true);
  await page.waitForTimeout(120);
  await setButton(page, CROSS, false);
  await expect(playButton).toHaveAttribute('data-playing', 'false');
});

test('mantener Cross hace scroll continuo sin alternar play/pausa', async ({ page }) => {
  const playButton = page.getByTestId('play-pause');
  const before = await prompterOffset(page);

  await setButton(page, CROSS, true);
  await page.waitForTimeout(800);
  const during = await prompterOffset(page);
  expect(during).toBeGreaterThan(before);
  // El movimiento manual no cambia play/pause.
  await expect(playButton).toHaveAttribute('data-playing', 'false');

  await setButton(page, CROSS, false);
  await page.waitForTimeout(150);
  const afterRelease = await prompterOffset(page);
  await page.waitForTimeout(400);
  // Al soltar, el movimiento se detiene y la acción corta no se dispara.
  expect(Math.abs((await prompterOffset(page)) - afterRelease)).toBeLessThan(1);
  await expect(playButton).toHaveAttribute('data-playing', 'false');
});
