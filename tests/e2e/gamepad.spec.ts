import { expect, test } from '@playwright/test';
import { installFakeGamepad, openScriptInPrompter, prompterOffset, setButton } from './helpers';

const CROSS = 0;
const DPAD_UP = 12;

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

test('un ajuste desde el mando muestra el HUD y lo desvanece', async ({ page }) => {
  await expect(page.getByTestId('gamepad-status')).toHaveAttribute('data-connected', 'true');

  await setButton(page, DPAD_UP, true);
  await page.waitForTimeout(120);
  await setButton(page, DPAD_UP, false);

  const feedback = page.getByTestId('adjustment-feedback');
  await expect(feedback).toHaveAttribute('data-setting', 'fontSize');
  await expect(feedback).toHaveAttribute('data-phase', 'visible');
  await expect(page.getByTestId('adjustment-feedback-value')).toHaveText('62px');
  await expect(feedback).toHaveCount(0, { timeout: 2_000 });
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
