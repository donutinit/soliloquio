import { expect, test } from '@playwright/test';
import { cardByTitle, createScriptFixture, openScriptInPrompter, prompterOffset } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openScriptInPrompter(page, 'Welcome to Soliloquio');
});

test('reproduce y pausa el desplazamiento automático', async ({ page }) => {
  const playButton = page.getByTestId('play-pause');
  await expect(playButton).toHaveAttribute('data-playing', 'false');
  await expect(page.getByTestId('top-controls')).toBeVisible();

  await playButton.click();
  await expect(playButton).toHaveAttribute('data-playing', 'true');
  await expect(page.getByTestId('top-controls')).toBeHidden();
  await expect(page.getByTestId('bottom-controls')).toBeVisible();
  const start = await prompterOffset(page);
  await page.waitForTimeout(600);
  const moved = await prompterOffset(page);
  expect(moved).toBeGreaterThan(start);

  const bottomControls = page.getByTestId('bottom-controls');
  await expect(bottomControls).toBeHidden();
  await expect(bottomControls).toHaveCSS('opacity', '0');
  await expect(bottomControls).toHaveCSS('transform', 'none');
  await page.getByTestId('prompter-viewport').click({ position: { x: 180, y: 180 } });
  await expect(bottomControls).toBeVisible();
  await expect(bottomControls).toHaveCSS('opacity', '1');
  await playButton.click();
  await expect(playButton).toHaveAttribute('data-playing', 'false');
  await expect(page.getByTestId('top-controls')).toBeVisible();
  const paused = await prompterOffset(page);
  await page.waitForTimeout(400);
  expect(Math.abs((await prompterOffset(page)) - paused)).toBeLessThan(1);
});

test('los ajustes manuales cambian valores sin mostrar el HUD del mando', async ({ page }) => {
  await page.getByTestId('settings-toggle').click();

  const speedBefore = Number.parseInt((await page.getByTestId('speed-value').textContent()) ?? '', 10);
  await page.getByTestId('speed-plus').click();
  await expect(page.getByTestId('speed-value')).toHaveText(`${speedBefore + 5} wpm`);
  await expect(page.getByTestId('adjustment-feedback')).toHaveCount(0);

  await expect(page.getByTestId('font-value')).toHaveText('60px');
  await page.getByTestId('font-plus').click();
  await expect(page.getByTestId('font-value')).toHaveText('62px');
  await expect(page.getByTestId('adjustment-feedback')).toHaveCount(0);
  const fontSize = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-block-type="text"]')!).fontSize
  );
  expect(fontSize).toBe('62px');

  await expect(page.getByTestId('margin-value')).toHaveText('4%');
  await page.getByTestId('margin-plus').click();
  await expect(page.getByTestId('margin-value')).toHaveText('5%');
  await expect(page.getByTestId('adjustment-feedback')).toHaveCount(0);
});

test('vuelve al inicio y a la lista de guiones', async ({ page }) => {
  await page.getByTestId('play-pause').click();
  await page.waitForTimeout(500);
  await page.getByTestId('play-pause').click(); // pausa antes de medir
  await page.getByTestId('reset-position').click();
  await expect.poll(() => prompterOffset(page)).toBe(0);

  await page.getByTestId('back-to-scripts').click();
  await expect(page.getByTestId('new-script')).toBeVisible();
});

test('el teclado revela los controles ocultos y Tab enfoca Play', async ({ page }) => {
  const playButton = page.getByTestId('play-pause');
  await playButton.click();
  await expect(playButton).toHaveAttribute('data-playing', 'true');
  const bottomControls = page.getByTestId('bottom-controls');
  await expect(bottomControls).toBeHidden();

  await page.keyboard.press('Tab');
  await expect(bottomControls).toBeVisible();
  await expect(playButton).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(bottomControls).toBeVisible();
});

test('Space pausa desde el teclado y no depende de los controles visibles', async ({ page }) => {
  const playButton = page.getByTestId('play-pause');
  await playButton.click();
  await expect(playButton).toHaveAttribute('data-playing', 'true');
  const bottomControls = page.getByTestId('bottom-controls');
  await expect(bottomControls).toBeHidden();

  await page.keyboard.press(' ');
  await expect(playButton).toHaveAttribute('data-playing', 'false');
  await expect(bottomControls).toBeVisible();
});

test('desktop wheel and keyboard navigate the reader without taking over focused inputs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const content = await page.getByTestId('prompter-content').boundingBox();
  expect(content).not.toBeNull();
  expect(content!.width).toBeLessThanOrEqual(1060);
  expect(Math.abs(content!.x - (1440 - content!.width) / 2)).toBeLessThan(2);

  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 420);
  await expect.poll(() => prompterOffset(page)).toBeGreaterThan(0);
  const afterWheel = await prompterOffset(page);

  await page.keyboard.press('ArrowDown');
  await expect.poll(() => prompterOffset(page)).toBeGreaterThan(afterWheel);
  await page.keyboard.press('Home');
  await expect.poll(() => prompterOffset(page)).toBe(0);
  await page.keyboard.press('End');
  await expect.poll(() => prompterOffset(page)).toBeGreaterThan(0);
  await page.keyboard.press('Home');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('section-indicator')).toHaveText('2 / 4');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('section-indicator')).toHaveText('1 / 4');
  await page.keyboard.press('+');
  await expect(page.getByTestId('speed-quick-value')).toHaveText('135');

  await page.getByTestId('speed-quick-plus').click();
  await expect(page.getByTestId('section-indicator')).toHaveText('1 / 4');
  await expect(page.getByTestId('speed-quick-value')).toHaveText('140');
  await page.getByTestId('speed-quick-minus').click();
  await expect(page.getByTestId('speed-quick-value')).toHaveText('135');
});

test('un guion corto termina el desplazamiento solo y recupera los controles', async ({ page }) => {
  await page.getByTestId('back-to-scripts').click();
  await page.getByTestId('new-script').click();
  await page.getByTestId('editor-title').fill('Tiny');
  await page.getByTestId('editor-content').fill('ok');
  await page.getByTestId('editor-close').click();
  await page
    .locator('[data-testid="script-card"]')
    .filter({ hasText: 'Tiny' })
    .getByTestId('open-prompter')
    .click();
  await expect(page.getByTestId('prompter-page')).toBeVisible();

  const playButton = page.getByTestId('play-pause');
  await playButton.click();
  await expect(playButton).toHaveAttribute('data-playing', 'true');
  await expect(playButton).toHaveAttribute('data-playing', 'false', { timeout: 8000 });
  await expect(page.getByTestId('bottom-controls')).toBeVisible();
  await expect(playButton).toBeEnabled();
});

test('landscape controls and controller guide stay inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const controls = await page.getByTestId('bottom-controls').boundingBox();
  expect(controls).not.toBeNull();
  expect(controls!.height).toBeLessThan(72);
  expect(controls!.x).toBeGreaterThanOrEqual(0);
  expect(controls!.x + controls!.width).toBeLessThanOrEqual(844);

  await page.getByTestId('gamepad-status').click();
  const guide = await page.getByTestId('controller-guide').boundingBox();
  expect(guide).not.toBeNull();
  expect(guide!.x).toBeGreaterThanOrEqual(0);
  expect(guide!.y).toBeGreaterThanOrEqual(0);
  expect(guide!.x + guide!.width).toBeLessThanOrEqual(844);
  expect(guide!.y + guide!.height).toBeLessThanOrEqual(390);
  await expect(page.getByTestId('controller-diagram')).toBeVisible();
  await expect(page.getByTestId('controller-diagram')).toBeInViewport();
  await expect(page.getByTestId('controller-diagram')).toHaveAttribute(
    'data-controller-family',
    'playstation'
  );
  await expect(page.getByTestId('controller-diagram')).toHaveAttribute(
    'data-controller-model',
    'playstation'
  );
  await expect(page.getByRole('img', { name: 'DualShock 4 button layout' })).toBeVisible();
  await expect(page.getByTestId('controller-guide')).toContainText('Left stick · scroll');

  const diagram = await page.getByTestId('controller-diagram').boundingBox();
  const legend = await page
    .getByRole('list', { name: 'Controller button assignments' })
    .boundingBox();
  expect(diagram).not.toBeNull();
  expect(legend).not.toBeNull();
  if (!diagram || !legend) throw new Error('Controller diagram or legend has no bounding box.');
  expect(legend.width).toBeGreaterThan(diagram.width);
});

test('opens the current script directly in the editor', async ({ page }) => {
  await page.getByTestId('edit-script').click();
  await expect(page.getByTestId('editor-title')).toHaveValue('Welcome to Soliloquio');
  await expect(page.getByTestId('editor-content')).toHaveValue(/This sample script/);
});

test('muestra notas y énfasis y se detiene en cada pausa', async ({ page }) => {
  await page.getByTestId('back-to-scripts').click();
  await createScriptFixture(
    page,
    'Formatted',
    '# Opening\n\nSay this **clearly** and *warmly* to the lens.\n\n> Look at the lens\n\n---\n\nAfter the pause we keep going with a few more words to read.'
  );
  await cardByTitle(page, 'Formatted').getByTestId('open-prompter').click();

  await expect(page.locator('[data-block-type="note"]')).toHaveText(/Look at the lens/);
  await expect(page.locator('[data-block-type="text"] strong')).toHaveText('clearly');
  await expect(page.locator('[data-block-type="text"] em')).toHaveText('warmly');
  await expect(page.locator('[data-block-type="pause"]')).toHaveCount(1);

  const playButton = page.getByTestId('play-pause');
  await playButton.click();
  await expect(playButton).toHaveAttribute('data-playing', 'true');
  await expect(playButton).toHaveAttribute('data-playing', 'false', { timeout: 10_000 });
  await expect(page.getByTestId('bottom-controls')).toHaveAttribute('data-visible', 'true');
  const heldAt = await prompterOffset(page);
  expect(heldAt).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect(Math.abs((await prompterOffset(page)) - heldAt)).toBeLessThan(1);

  await playButton.click();
  await expect.poll(() => prompterOffset(page)).toBeGreaterThan(heldAt + 5);
});

test('la velocidad en palabras por minuto no cambia el tiempo restante al agrandar el texto', async ({
  page
}) => {
  const remaining = page.getByTestId('time-remaining');
  await expect(remaining).toContainText(/≈ \d+:\d{2} left/);
  const before = await remaining.textContent();

  await page.getByTestId('settings-toggle').click();
  for (let i = 0; i < 5; i += 1) await page.getByTestId('font-plus').click();
  await page.getByTestId('settings-close').click();

  await expect(page.getByTestId('font-value')).toHaveCount(0);
  await expect.poll(() => remaining.textContent()).toBe(before);
});

test('holds on a timed pause, keeps playing, and counts elapsed time', async ({ page }) => {
  await page.getByTestId('back-to-scripts').click();
  const filler = Array.from({ length: 40 }, (_, i) => `Line ${i} keeps the script long enough.`).join(
    '\n\n'
  );
  await createScriptFixture(page, 'Timed', `Opening words to read.\n--- 2s\n${filler}`);
  await cardByTitle(page, 'Timed').getByTestId('open-prompter').click();

  await expect(page.locator('[data-block-type="pause"]')).toHaveText('Pause · 2s');
  await expect(page.getByTestId('elapsed-time')).toContainText('0:00');
  const playButton = page.getByTestId('play-pause');
  await playButton.click();
  // The hold keeps playback on and the text still, then scrolling resumes by itself.
  await expect
    .poll(async () => {
      const before = await prompterOffset(page);
      await page.waitForTimeout(300);
      return Math.abs((await prompterOffset(page)) - before) < 1 && before > 0;
    }, { timeout: 15_000 })
    .toBe(true);
  await expect(playButton).toHaveAttribute('data-playing', 'true');
  const heldAt = await prompterOffset(page);
  await expect.poll(() => prompterOffset(page), { timeout: 5_000 }).toBeGreaterThan(heldAt + 5);

  await page.keyboard.press('Space');
  await expect(playButton).toHaveAttribute('data-playing', 'false');
  await expect(page.getByTestId('bottom-controls')).toHaveAttribute('data-visible', 'true');
  await expect(page.getByTestId('elapsed-time')).not.toContainText('0:00');
  await page.getByTestId('reset-position').click();
  await expect(page.getByTestId('elapsed-time')).toContainText('0:00');
});

test('the Display panel mirrors the text and fits the script to a length', async ({ page }) => {
  await page.getByTestId('settings-toggle').click();
  await expect(page.getByRole('heading', { name: 'Display' })).toBeVisible();

  await page.getByTestId('reader-mirror-setting').check({ force: true });
  await expect(page.getByTestId('prompter-viewport')).toHaveAttribute('data-mirrored', 'true');

  await page.getByTestId('fit-30').click();
  await expect(page.getByTestId('fit-result')).toHaveText(/^\d+ wpm: about 0:[23]\d\.$/);
  const fitted = await page.getByTestId('speed-value').textContent();
  await page.getByTestId('fit-180').click();
  await expect(page.getByTestId('fit-result')).toHaveText(/^Slowest pace is 40 wpm: about \d:\d{2}\.$/);
  await expect(page.getByTestId('speed-value')).toHaveText('40 wpm');
  expect(fitted).not.toBe('40 wpm');
  await page.getByTestId('settings-close').click();

  // Both settings are global and persist.
  await page.getByTestId('back-to-scripts').click();
  await page.getByTestId('app-settings-button').click();
  await expect(page.getByTestId('mirror-text-setting')).toBeChecked();
});
