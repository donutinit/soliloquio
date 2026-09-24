import { expect, test } from '@playwright/test';
import {
  installFakeGamepad,
  openScriptInPrompter,
  prompterOffset,
  setAxis,
  setButton,
  setGamepadConnected
} from './helpers';

const CROSS = 0;
const SQUARE = 2;
const TRIANGLE = 3;
const DPAD_UP = 12;
const LEFT_STICK_Y = 1;
const RIGHT_STICK_Y = 3;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeGamepad, { connected: false });
  await page.goto('/');
  await openScriptInPrompter(page, 'Welcome to Soliloquio');
});

test('detecta el mando simulado', async ({ page }) => {
  await setGamepadConnected(page, true);
  await expect(page.getByTestId('gamepad-status')).toHaveAttribute('data-connected', 'true');
});

test('la pulsación que revela el mando en el lector alterna play/pausa', async ({ page }) => {
  const playButton = page.getByTestId('play-pause');
  await expect(playButton).toHaveAttribute('data-playing', 'false');

  await setButton(page, CROSS, true);
  await setGamepadConnected(page, true);
  await page.waitForTimeout(120);
  await setButton(page, CROSS, false);
  await expect(playButton).toHaveAttribute('data-playing', 'true');

  await setButton(page, CROSS, true);
  await page.waitForTimeout(120);
  await setButton(page, CROSS, false);
  await expect(playButton).toHaveAttribute('data-playing', 'false');
});

test('play/pausa desde el mando no revela la barra de controles', async ({ page }) => {
  const playButton = page.getByTestId('play-pause');
  const bottomControls = page.getByTestId('bottom-controls');
  await setGamepadConnected(page, true);
  await expect(page.getByTestId('gamepad-status')).toHaveAttribute('data-connected', 'true');

  // Square es la acción explícita Show / hide controls en el layout por defecto.
  await setButton(page, SQUARE, true);
  await page.waitForTimeout(120);
  await setButton(page, SQUARE, false);
  await expect(bottomControls).toBeHidden();

  await setButton(page, CROSS, true);
  await page.waitForTimeout(120);
  await setButton(page, CROSS, false);
  await expect(playButton).toHaveAttribute('data-playing', 'true');
  await expect(bottomControls).toBeHidden();

  await setButton(page, CROSS, true);
  await page.waitForTimeout(120);
  await setButton(page, CROSS, false);
  await expect(playButton).toHaveAttribute('data-playing', 'false');
  await expect(bottomControls).toBeHidden();

  await setButton(page, SQUARE, true);
  await page.waitForTimeout(120);
  await setButton(page, SQUARE, false);
  await expect(bottomControls).toBeVisible();
});

test('un ajuste desde el mando muestra el HUD y lo desvanece', async ({ page }) => {
  await setGamepadConnected(page, true);
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

test('mantener Cross no hace scroll y alterna play/pausa al soltar', async ({ page }) => {
  const playButton = page.getByTestId('play-pause');
  await setGamepadConnected(page, true);
  await expect(page.getByTestId('gamepad-status')).toHaveAttribute('data-connected', 'true');
  const before = await prompterOffset(page);

  await setButton(page, CROSS, true);
  await page.waitForTimeout(800);
  expect(await prompterOffset(page)).toBe(before);
  await expect(playButton).toHaveAttribute('data-playing', 'false');
  await setButton(page, CROSS, false);
  await expect(playButton).toHaveAttribute('data-playing', 'true');
});

test('Triangle vuelve al inicio al mantenerlo o con doble toque', async ({ page }) => {
  await setGamepadConnected(page, true);
  await expect(page.getByTestId('gamepad-status')).toHaveAttribute('data-connected', 'true');

  await setAxis(page, LEFT_STICK_Y, 1);
  await page.waitForTimeout(400);
  await setAxis(page, LEFT_STICK_Y, 0);
  await page.waitForTimeout(100);
  const scrolled = await prompterOffset(page);
  expect(scrolled).toBeGreaterThan(100);

  // Un toque no hace nada.
  await setButton(page, TRIANGLE, true);
  await page.waitForTimeout(120);
  await setButton(page, TRIANGLE, false);
  await page.waitForTimeout(200);
  expect(await prompterOffset(page)).toBe(scrolled);

  await setButton(page, TRIANGLE, true);
  await expect.poll(() => prompterOffset(page)).toBe(0);
  await setButton(page, TRIANGLE, false);

  // Un doble toque también vuelve al inicio.
  await setAxis(page, LEFT_STICK_Y, 1);
  await page.waitForTimeout(400);
  await setAxis(page, LEFT_STICK_Y, 0);
  await expect.poll(() => prompterOffset(page)).toBeGreaterThan(100);
  await page.waitForTimeout(500);
  for (let tap = 0; tap < 2; tap += 1) {
    await setButton(page, TRIANGLE, true);
    await page.waitForTimeout(80);
    await setButton(page, TRIANGLE, false);
    await page.waitForTimeout(80);
  }
  await expect.poll(() => prompterOffset(page)).toBe(0);
});

test('el stick derecho frena hasta detener el scroll sin retroceder', async ({ page }) => {
  const playButton = page.getByTestId('play-pause');
  await setGamepadConnected(page, true);
  await expect(page.getByTestId('gamepad-status')).toHaveAttribute('data-connected', 'true');

  // En pausa, el stick derecho no mueve el texto en ningún sentido.
  await setAxis(page, RIGHT_STICK_Y, -1);
  await page.waitForTimeout(300);
  expect(await prompterOffset(page)).toBe(0);
  await setAxis(page, RIGHT_STICK_Y, 1);
  await page.waitForTimeout(300);
  expect(await prompterOffset(page)).toBe(0);
  await setAxis(page, RIGHT_STICK_Y, 0);

  await setButton(page, CROSS, true);
  await page.waitForTimeout(120);
  await setButton(page, CROSS, false);
  await expect(playButton).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => prompterOffset(page)).toBeGreaterThan(5);

  // A fondo hacia arriba detiene el autoscroll, pero la reproducción sigue activa.
  await setAxis(page, RIGHT_STICK_Y, -1);
  await page.waitForTimeout(150);
  const braked = await prompterOffset(page);
  await page.waitForTimeout(500);
  expect(Math.abs((await prompterOffset(page)) - braked)).toBeLessThan(1);
  await expect(playButton).toHaveAttribute('data-playing', 'true');

  // Al soltarlo, el texto retoma la velocidad configurada.
  await setAxis(page, RIGHT_STICK_Y, 0);
  await expect.poll(() => prompterOffset(page)).toBeGreaterThan(braked + 5);
});
