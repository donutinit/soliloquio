import { expect, test } from '@playwright/test';
import { openScriptInPrompter, prompterOffset } from './helpers';

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

  const speedBefore = Number(await page.getByTestId('speed-value').textContent());
  await page.getByTestId('speed-plus').click();
  await expect(page.getByTestId('speed-value')).toHaveText(String(speedBefore + 5));
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
  await expect(page.getByTestId('controller-guide')).toContainText('Left stick · fast scroll');

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
