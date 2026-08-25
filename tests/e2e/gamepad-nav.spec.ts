import { expect, test, type Page } from '@playwright/test';
import {
  cardByTitle,
  installFakeGamepad,
  openScriptInPrompter,
  setButton,
  setGamepadConnected
} from './helpers';

const SOUTH = 0;
const EAST = 1;
const DPAD_DOWN = 13;
const DPAD_RIGHT = 15;
const SHARE = 8;
const OPTIONS = 9;
const R3 = 11;

/** Espera a que el modo navegación esté activo y cebado antes de pulsar. */
async function waitForNavReady(page: Page): Promise<void> {
  await expect(page.locator(':root')).toHaveAttribute('data-gamepad-nav-ready', 'true');
}

async function pressNav(page: Page, button: number): Promise<void> {
  await setButton(page, button, true);
  await page.waitForTimeout(150);
  await setButton(page, button, false);
  await page.waitForTimeout(120);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeGamepad, { connected: false });
  await page.goto('/');
  await setGamepadConnected(page, true);
});

test('al detectar el mando enfoca el primer guion y permite navegarlo', async ({ page }) => {
  await waitForNavReady(page);

  const card = cardByTitle(page, 'Quick notes');
  const cardMain = card.getByTestId('open-prompter');
  await expect(cardMain).toBeFocused();
  await expect(page.locator(':root')).toHaveAttribute('data-gamepad-nav', 'true');

  // Una tarjeta enfocada se resalta entera: su botón llena la tarjeta y el
  // overflow:hidden recortaría un anillo exterior.
  await expect(cardMain).toHaveCSS('outline-style', 'none');
  await expect
    .poll(() =>
      card.evaluate((element) => {
        const ring = getComputedStyle(element, '::after');
        return `${ring.borderTopColor}|${ring.borderTopLeftRadius}`;
      })
    )
    .toBe('rgb(255, 175, 208)|19px');

  // El d-pad baja al siguiente guion visible.
  await pressNav(page, DPAD_DOWN);
  await expect(page.getByTestId('open-prompter').nth(1)).toBeFocused();

  // The overflow menu remains available to touch/keyboard, but controller
  // confirm must neither open it nor leave focus trapped on it.
  await card.getByTestId('card-menu').focus();
  await pressNav(page, SOUTH);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Help' })).toBeFocused();

  // Sur activa el elemento enfocado: con una tarjeta enfocada, abre el prompter.
  await cardMain.focus();
  await pressNav(page, SOUTH);
  await expect(page.getByTestId('prompter-page')).toBeVisible();
  await expect(page.getByTestId('play-pause')).toHaveAttribute('data-playing', 'false');

  // Círculo/B/Este sale del lector y devuelve el cursor al mismo guion, no al header.
  await pressNav(page, EAST);
  await expect(page.getByTestId('prompter-page')).toHaveCount(0);
  await expect(cardMain).toBeFocused();
  await expect(page.locator(':root')).toHaveAttribute('data-gamepad-nav', 'true');
});

test('dentro de un modal el foco queda atrapado y Este lo cierra', async ({ page }) => {
  await waitForNavReady(page);
  await page.getByTestId('app-settings-button').click();
  await expect(page.getByTestId('app-settings-panel')).toBeVisible();

  // El modal autoenfoca el select del countdown; bajar recorre los ajustes nuevos y existentes.
  await expect(page.getByTestId('countdown-setting')).toBeFocused();
  await pressNav(page, DPAD_DOWN);
  await expect(page.getByTestId('card-title-size-setting')).toBeFocused();
  await pressNav(page, DPAD_DOWN);
  await expect(page.getByTestId('keep-awake-setting')).toBeFocused();

  await pressNav(page, EAST);
  await expect(page.getByTestId('app-settings-panel')).toHaveCount(0);
});

test('Share opens the controller guide and R3 opens section navigation', async ({
  page
}) => {
  await openScriptInPrompter(page, 'Welcome to Teleprompter');
  const fontBefore = await page
    .getByTestId('prompter-content')
    .evaluate((el) => el.style.getPropertyValue('--prompter-font-size'));

  // Durante la lectura no hay modo navegación: el lector es dueño del mando.
  await expect(page.locator(':root')).not.toHaveAttribute('data-gamepad-nav-ready', 'true');

  // Share/View/Minus/Select opens a controller-family-aware reference.
  await pressNav(page, SHARE);
  await expect(page.getByTestId('controller-guide')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PlayStation controls' })).toBeVisible();
  await expect(page.getByTestId('controller-guide-toggleControllerGuide')).toContainText(
    'Share / Create'
  );
  await expect(page.getByTestId('controller-guide-toggleSections')).toContainText('R3');
  await waitForNavReady(page);
  await expect(page.getByRole('button', { name: 'Done' })).toBeFocused();
  await pressNav(page, DPAD_DOWN);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? ''))
    .toMatch(/^controller-guide-/);

  await pressNav(page, EAST);
  await expect(page.getByTestId('controller-guide')).toHaveCount(0);

  // R3 opens the section panel; focus lands on the first section.
  await pressNav(page, R3);
  await expect(page.getByTestId('sections-panel')).toBeVisible();
  await expect(page.getByTestId('section-item').first()).toBeFocused();
  await waitForNavReady(page);

  // El d-pad navega la lista (y no cambia el tamaño de letra del lector).
  await pressNav(page, DPAD_DOWN);
  await expect(page.getByTestId('section-item').nth(1)).toBeFocused();

  // Sur selecciona la sección: salta y cierra el panel sin alternar play/pausa.
  await pressNav(page, SOUTH);
  await expect(page.getByTestId('sections-panel')).toHaveCount(0);
  await expect(page.getByTestId('section-indicator')).toHaveText(/^2 \//);
  await expect(page.getByTestId('play-pause')).toHaveAttribute('data-playing', 'false');

  const fontAfter = await page
    .getByTestId('prompter-content')
    .evaluate((el) => el.style.getPropertyValue('--prompter-font-size'));
  expect(fontAfter).toBe(fontBefore);
});

test('los sliders del panel de ajustes se ajustan con el d-pad', async ({ page }) => {
  await openScriptInPrompter(page, 'Welcome to Teleprompter');

  // Options abre Settings; el foco cae en el primer control (menos velocidad).
  await pressNav(page, OPTIONS);
  await expect(page.getByTestId('settings-panel')).toBeVisible();
  await expect(page.getByTestId('speed-minus')).toBeFocused();
  await waitForNavReady(page);

  // Derecha enfoca el slider; con el slider enfocado, derecha sube el valor.
  await pressNav(page, DPAD_RIGHT);
  await expect(page.getByTestId('speed-slider')).toBeFocused();
  await pressNav(page, DPAD_RIGHT);
  await expect(page.getByTestId('speed-value')).toHaveText('60');
  await expect(page.getByTestId('adjustment-feedback')).toHaveAttribute(
    'data-setting',
    'speed'
  );
  await expect(page.getByTestId('adjustment-feedback-value')).toHaveText('60');

  await pressNav(page, EAST);
  await expect(page.getByTestId('settings-panel')).toHaveCount(0);
});

test('el modo escucha del panel Gamepad suspende la navegación', async ({ page }) => {
  await waitForNavReady(page);
  await page.getByTestId('app-settings-button').click();
  await page.getByTestId('open-gamepad-settings').click();
  await expect(page.getByTestId('gamepad-settings-panel')).toBeVisible();
  await waitForNavReady(page);

  await page.getByTestId('bind-togglePlay').click();
  await expect(page.getByTestId('bind-togglePlay-value')).toHaveText('Press…');
  // En modo escucha la navegación queda suspendida (la baliza desaparece).
  await expect(page.locator(':root')).not.toHaveAttribute('data-gamepad-nav-ready', 'true');

  // Sur asigna el botón; si la navegación no estuviera suspendida, este mismo
  // press haría clic en la fila enfocada y reabriría la escucha ("Press…").
  await pressNav(page, SOUTH);
  await expect(page.getByTestId('gamepad-feedback')).toContainText('Play / Pause is now Cross.');
  await expect(page.getByTestId('bind-togglePlay-value')).toHaveText('Cross');
  await expect(page.getByTestId('gamepad-settings-panel')).toBeVisible();
});

test('Diagnostics muestra la entrada cruda sin navegar la interfaz', async ({ page }) => {
  await waitForNavReady(page);
  await page.getByTestId('app-settings-button').click();
  await page.getByTestId('open-gamepad-settings').click();
  await expect(page.getByTestId('gamepad-settings-panel')).toBeVisible();
  await waitForNavReady(page);

  const toggle = page.getByTestId('gamepad-diagnostics-toggle');
  await toggle.click();
  await expect(page.getByTestId('gamepad-diagnostics')).toBeVisible();
  await expect(toggle).toBeFocused();
  // Diagnostics conserva el sondeo crudo, pero suspende el lector que mueve
  // el foco, confirma controles o cierra el modal.
  await expect(page.locator(':root')).not.toHaveAttribute('data-gamepad-nav-ready', 'true');

  await setButton(page, DPAD_DOWN, true);
  await expect(page.getByTestId('gamepad-diagnostics')).toContainText('13:■1.00');
  await expect(toggle).toBeFocused();
  await setButton(page, DPAD_DOWN, false);

  await setButton(page, EAST, true);
  await expect(page.getByTestId('gamepad-diagnostics')).toContainText('1:■1.00');
  await setButton(page, EAST, false);
  await expect(page.getByTestId('gamepad-settings-panel')).toBeVisible();
  await expect(toggle).toBeFocused();

  await toggle.click();
  await expect(page.getByTestId('gamepad-diagnostics')).toHaveCount(0);
  await waitForNavReady(page);
});
