import { expect, test } from '@playwright/test';
import { installFakeGamepad, openScriptInPrompter, setButton, setButtons } from './helpers';

const R1 = 5;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeGamepad);
  await page.goto('/');
});

async function openGamepadSettings(page: import('@playwright/test').Page): Promise<void> {
  await page.getByTestId('app-settings-button').click();
  await page.getByTestId('open-gamepad-settings').click();
  await expect(page.getByTestId('gamepad-settings-panel')).toBeVisible();
}

test('muestra todas las acciones con sus botones por defecto', async ({ page }) => {
  await page.setViewportSize({ width: 1066, height: 700 });
  await openGamepadSettings(page);
  await expect(page.getByTestId('gamepad-settings-status')).toContainText('PlayStation controller');
  await expect(page.getByTestId('bind-togglePlay-value')).toHaveText('Cross');
  await expect(page.getByTestId('bind-nextSection-value')).toHaveText('R1');
  await expect(page.getByTestId('bind-speedUp-value')).toHaveText('R2');
  await expect(page.getByTestId('bind-marginUp-value')).toHaveText('D-pad Right');
  await expect(page.getByTestId('bind-backToScripts-value')).toHaveText('Circle');

  const status = await page.getByTestId('gamepad-settings-status').boundingBox();
  const hint = await page.getByTestId('gamepad-settings-hint').boundingBox();
  expect(status).not.toBeNull();
  expect(hint).not.toBeNull();
  if (!status || !hint) throw new Error('Gamepad status or hint has no bounding box.');
  expect(Math.abs(status.x - hint.x)).toBeLessThan(1);
  expect(Math.abs(status.width - hint.width)).toBeLessThan(1);
});

test('con un mando Xbox adapta el nombre y la serigrafía de los botones', async ({ page }) => {
  await page.addInitScript(
    installFakeGamepad,
    'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'
  );
  await page.goto('/');
  await openGamepadSettings(page);
  await expect(page.getByTestId('gamepad-settings-status')).toContainText('Xbox controller');
  await expect(page.getByTestId('bind-togglePlay-value')).toHaveText('A');
  await expect(page.getByTestId('bind-nextSection-value')).toHaveText('RB');
  await expect(page.getByTestId('bind-toggleControllerGuide-value')).toHaveText('View');
  await expect(page.getByTestId('bind-toggleSections-value')).toHaveText('RS');
  await expect(page.getByTestId('bind-marginUp-value')).toHaveText('D-pad Right');

  await page.getByTestId('gamepad-settings-done').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await openScriptInPrompter(page, 'Welcome to Soliloquio');
  await page.getByTestId('gamepad-status').click();
  await expect(page.getByTestId('controller-diagram')).toHaveAttribute(
    'data-controller-family',
    'xbox'
  );
  await expect(page.getByTestId('controller-diagram')).toHaveAttribute(
    'data-controller-model',
    'xbox'
  );
  await expect(page.getByRole('img', { name: 'Xbox controller button layout' })).toBeVisible();
});

test('el Pro 3 normaliza A/B/X/Y y reconstruye sus botones extra en Safari', async ({ page }) => {
  await page.addInitScript(installFakeGamepad, '8BitDo Pro 3 Extended Gamepad');
  await page.goto('/');
  await openGamepadSettings(page);

  await expect(page.getByTestId('gamepad-settings-status')).toContainText(
    '8BitDo Pro 3 controller'
  );
  await expect(page.getByTestId('bind-togglePlay-value')).toHaveText('B');
  await expect(page.getByTestId('bind-backToScripts-value')).toHaveText('A');
  await expect(page.getByTestId('gamepad-settings-hint')).toContainText(
    'B confirms and A goes back'
  );
  await expect(page.getByTestId('gamepad-settings-hint')).toContainText(
    'map L4/R4/PL/PR on the controller'
  );

  // El índice crudo 0 es A en este mando. Al remapearlo, la app debe guardar
  // la posición Este (A), no etiquetarlo erróneamente como B/Sur.
  await page.getByTestId('bind-togglePlay').click();
  await setButton(page, 0, true);
  await expect(page.getByTestId('bind-togglePlay-value')).toHaveText('A');
  await expect(page.getByTestId('bind-backToScripts-value')).toHaveText('B');
  await setButton(page, 0, false);

  // WebKit oculta L4, pero el remapeo interno Select+A llega en un solo
  // reporte y se reconstruye como un botón virtual independiente.
  await page.getByTestId('bind-toggleSections').click();
  await setButtons(page, [
    [8, true],
    [0, true]
  ]);
  await expect(page.getByTestId('bind-toggleSections-value')).toHaveText('L4');
  await setButtons(page, [
    [8, false],
    [0, false]
  ]);

  await page.getByTestId('gamepad-settings-done').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await openScriptInPrompter(page, 'Welcome to Soliloquio');
  await page.getByTestId('gamepad-status').click();
  await expect(page.getByRole('heading', { name: '8BitDo Pro 3 controls' })).toBeVisible();
  await expect(page.getByTestId('controller-diagram')).toHaveAttribute(
    'data-controller-model',
    '8bitdo-pro-3'
  );
  await expect(page.getByRole('img', { name: '8BitDo Pro 3 button layout' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(100);
  await setButtons(page, [
    [8, true],
    [0, true]
  ]);
  await page.waitForTimeout(120);
  await setButtons(page, [
    [8, false],
    [0, false]
  ]);
  await expect(page.getByTestId('sections-panel')).toBeVisible();
});

test('reasignar a un botón ocupado intercambia las dos acciones y persiste', async ({ page }) => {
  await openGamepadSettings(page);

  // El mando solo aparece tras una pulsación; además inicia la escucha limpia.
  await setButton(page, R1, true);
  await setButton(page, R1, false);

  await page.getByTestId('bind-speedUp').click();
  await expect(page.getByTestId('bind-speedUp-value')).toHaveText('Press…');
  await setButton(page, R1, true);
  await expect(page.getByTestId('bind-speedUp-value')).toHaveText('R1');
  await setButton(page, R1, false);

  // R1 pertenecía a "Next section", que recibe R2 (el botón anterior de "Faster").
  await expect(page.getByTestId('gamepad-feedback')).toContainText('Next section moved to R2');
  await expect(page.getByTestId('bind-nextSection-value')).toHaveText('R2');

  // Cerrar espera el guardado pendiente; la asignación sobrevive a una recarga.
  await page.getByTestId('gamepad-settings-done').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('app-settings-panel')).toHaveCount(0);
  await page.reload();
  await openGamepadSettings(page);
  await expect(page.getByTestId('bind-speedUp-value')).toHaveText('R1');
  await page.getByTestId('gamepad-settings-done').click();
  await page.getByRole('button', { name: 'Done' }).click();

  // En el prompter, el botón reasignado dispara la nueva acción.
  await openScriptInPrompter(page, 'Welcome to Soliloquio');
  const speedValue = page.getByTestId('speed-quick-value');
  const before = Number(await speedValue.textContent());
  await setButton(page, R1, true);
  await page.waitForTimeout(120);
  await setButton(page, R1, false);
  await expect(speedValue).toHaveText(String(before + 5));
});

test('restaurar los valores por defecto desde el panel', async ({ page }) => {
  await openGamepadSettings(page);
  await setButton(page, R1, true);
  await setButton(page, R1, false);

  await page.getByTestId('bind-togglePlay').click();
  await setButton(page, R1, true);
  await expect(page.getByTestId('bind-togglePlay-value')).toHaveText('R1');
  await setButton(page, R1, false);

  await page.getByTestId('gamepad-reset').click();
  await expect(page.getByTestId('bind-togglePlay-value')).toHaveText('Cross');
  await expect(page.getByTestId('gamepad-feedback')).toContainText('Default buttons restored.');
});
