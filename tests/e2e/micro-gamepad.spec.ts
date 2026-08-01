import { expect, test } from '@playwright/test';
import { installFakeGamepad, openScriptInPrompter, prompterOffset, setButton } from './helpers';

const MICRO_ID = '8BitDo Micro gamepad Gamepad';
const B = 1;
const SELECT = 8;
const START = 9;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;

async function pressButton(page: import('@playwright/test').Page, button: number): Promise<void> {
  await setButton(page, button, true);
  await page.waitForTimeout(120);
  await setButton(page, button, false);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeGamepad, { padId: MICRO_ID });
  await page.goto('/');
});

test('muestra las asignaciones fijas del perfil 8BitDo Micro', async ({ page }) => {
  await page.getByTestId('app-settings-button').click();
  await page.getByTestId('open-gamepad-settings').click();

  await expect(page.getByTestId('gamepad-settings-status')).toContainText(
    '8BitDo Micro controller'
  );
  await expect(page.getByTestId('gamepad-settings-hint')).toContainText(
    '8BitDo Micro profile'
  );
  await expect(page.getByTestId('bind-toggleControllerGuide-value')).toHaveText('Select');
  await expect(page.getByTestId('bind-togglePlay-value')).toHaveText('B');
  await expect(page.getByTestId('bind-backToScripts-value')).toHaveText('A');
  await expect(page.getByTestId('bind-toggleControls-value')).toHaveText('Y');
  await expect(page.getByTestId('bind-resetToStart-value')).toHaveText('X');
  await expect(page.getByTestId('bind-fontUp-value')).toHaveText('Select + D-pad Up');
  await expect(page.getByTestId('bind-marginUp-value')).toHaveText('Select + D-pad Right');
  await expect(page.getByTestId('bind-toggleSections-value')).toHaveText('Select + B');
  await expect(page.getByTestId('bind-toggleControllerGuide')).toBeDisabled();
  await expect(page.getByTestId('bind-fontUp')).toBeDisabled();
  await expect(page.getByTestId('bind-toggleSections')).toBeDisabled();
});

test('aplica scroll y ajustes exclusivos del perfil Micro', async ({ page }) => {
  await openScriptInPrompter(page, 'Welcome to Teleprompter');
  await expect(page.getByTestId('gamepad-status')).toHaveAttribute('data-connected', 'true');
  const content = page.getByTestId('prompter-content');

  const start = await prompterOffset(page);
  await setButton(page, DPAD_RIGHT, true);
  await page.waitForTimeout(450);
  await setButton(page, DPAD_RIGHT, false);
  const afterRight = await prompterOffset(page);
  expect(afterRight).toBeGreaterThan(start + 20);

  await setButton(page, DPAD_LEFT, true);
  await page.waitForTimeout(250);
  await setButton(page, DPAD_LEFT, false);
  expect(await prompterOffset(page)).toBeLessThan(afterRight);

  const beforeSlow = await prompterOffset(page);
  await setButton(page, DPAD_UP, true);
  await page.waitForTimeout(650);
  await setButton(page, DPAD_UP, false);
  const afterSlow = await prompterOffset(page);
  const slowDelta = afterSlow - beforeSlow;
  expect(slowDelta).toBeGreaterThan(1);
  await expect
    .poll(() =>
      content.evaluate((element) => element.style.getPropertyValue('--prompter-font-size'))
    )
    .toBe('60px');

  await setButton(page, DPAD_DOWN, true);
  await page.waitForTimeout(650);
  await setButton(page, DPAD_DOWN, false);
  const fastDelta = (await prompterOffset(page)) - afterSlow;
  expect(fastDelta).toBeGreaterThan(slowDelta * 8);

  await setButton(page, SELECT, true);
  await setButton(page, DPAD_UP, true);
  await page.waitForTimeout(120);
  await setButton(page, DPAD_UP, false);
  await expect(page.getByTestId('adjustment-feedback')).toHaveAttribute(
    'data-setting',
    'fontSize'
  );
  await expect(page.getByTestId('adjustment-feedback-value')).toHaveText('62px');

  await setButton(page, DPAD_LEFT, true);
  await page.waitForTimeout(120);
  await setButton(page, DPAD_LEFT, false);
  await expect(page.getByTestId('adjustment-feedback')).toHaveAttribute(
    'data-setting',
    'horizontalMargin'
  );
  await expect(page.getByTestId('adjustment-feedback-value')).toHaveText('3%');
  await setButton(page, SELECT, false);
  await expect(page.getByTestId('controller-guide')).toHaveCount(0);

  await pressButton(page, SELECT);
  await expect(page.getByRole('heading', { name: '8BitDo Micro controls' })).toBeVisible();
  await expect(page.getByTestId('micro-controller-profile')).toContainText(
    'Temporary speed 20% / 200%'
  );
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('controller-guide')).toHaveCount(0);
  await page.waitForTimeout(100);

  // Select + B abre y cierra la lista sin seleccionar ni alternar playback.
  await setButton(page, SELECT, true);
  await pressButton(page, B);
  await expect(page.getByTestId('sections-panel')).toBeVisible();
  await expect(page.getByTestId('play-pause')).toHaveAttribute('data-playing', 'false');
  await setButton(page, SELECT, false);
  await page.waitForTimeout(100);

  await setButton(page, SELECT, true);
  await pressButton(page, B);
  await expect(page.getByTestId('sections-panel')).toHaveCount(0);
  await expect(page.getByTestId('section-indicator')).toHaveText(/^1 \/ /);
  await expect(page.getByTestId('play-pause')).toHaveAttribute('data-playing', 'false');
  await setButton(page, SELECT, false);
  await page.waitForTimeout(100);

  await pressButton(page, START);
  await expect(page.getByTestId('settings-panel')).toBeVisible();

  // La acción principal del botón Sur continúa disponible en el perfil Micro.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('settings-panel')).toHaveCount(0);
  await page.waitForTimeout(100);
  await pressButton(page, B);
  await expect(page.getByTestId('play-pause')).toHaveAttribute('data-playing', 'true');
});
