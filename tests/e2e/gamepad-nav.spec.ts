import { expect, test, type Page } from '@playwright/test';
import { cardByTitle, installFakeGamepad, openScriptInPrompter, setButton } from './helpers';

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
  await page.addInitScript(installFakeGamepad);
  await page.goto('/');
});

test('el d-pad enfoca la biblioteca y Sur activa el elemento enfocado', async ({ page }) => {
  await waitForNavReady(page);

  // Sin nada enfocado, el primer movimiento va al primer elemento de la página.
  await pressNav(page, DPAD_DOWN);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''))
    .toBe('Help');
  await expect(page.locator(':root')).toHaveAttribute('data-gamepad-nav', 'true');
  // El elemento enfocado muestra el anillo interior (no lo recorta ningún overflow).
  await expect(page.getByRole('button', { name: 'Help' })).toHaveCSS('outline-width', '3px');

  // Una tarjeta enfocada se resalta entera: su botón llena la tarjeta y el
  // overflow:hidden recortaría un anillo exterior.
  const card = cardByTitle(page, 'Welcome to Teleprompter');
  const cardMain = card.getByTestId('open-prompter');
  await cardMain.focus();
  await expect(cardMain).toHaveCSS('outline-style', 'none');
  await expect
    .poll(() =>
      card.evaluate((element) => {
        const ring = getComputedStyle(element, '::after');
        return `${ring.borderTopColor}|${ring.borderTopLeftRadius}`;
      })
    )
    .toBe('rgb(255, 175, 208)|19px');

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
