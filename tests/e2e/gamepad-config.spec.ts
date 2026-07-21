import { expect, test } from '@playwright/test';
import { installFakeGamepad, openScriptInPrompter, setButton } from './helpers';

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
  await openGamepadSettings(page);
  await expect(page.getByTestId('bind-togglePlay-value')).toHaveText('Cross');
  await expect(page.getByTestId('bind-nextSection-value')).toHaveText('R1');
  await expect(page.getByTestId('bind-speedUp-value')).toHaveText('R2');
  await expect(page.getByTestId('bind-marginUp-value')).toHaveText('D-pad Right');
  await expect(page.getByTestId('bind-backToScripts-value')).toHaveText('Circle');
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
  await openScriptInPrompter(page, 'Welcome to Teleprompter');
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
