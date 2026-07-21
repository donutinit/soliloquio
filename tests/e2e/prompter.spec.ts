import { expect, test } from '@playwright/test';
import { openScriptInPrompter, prompterOffset } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openScriptInPrompter(page, 'Bienvenida al teleprompter');
});

test('reproduce y pausa el desplazamiento automático', async ({ page }) => {
  const playButton = page.getByTestId('play-pause');
  await expect(playButton).toHaveAttribute('data-playing', 'false');

  await playButton.click();
  await expect(playButton).toHaveAttribute('data-playing', 'true');
  const start = await prompterOffset(page);
  await page.waitForTimeout(600);
  const moved = await prompterOffset(page);
  expect(moved).toBeGreaterThan(start);

  await playButton.click();
  await expect(playButton).toHaveAttribute('data-playing', 'false');
  const paused = await prompterOffset(page);
  await page.waitForTimeout(400);
  expect(Math.abs((await prompterOffset(page)) - paused)).toBeLessThan(1);
});

test('cambia velocidad, tamaño de fuente y márgenes desde ajustes', async ({ page }) => {
  await page.getByTestId('settings-toggle').click();

  const speedBefore = Number(await page.getByTestId('speed-value').textContent());
  await page.getByTestId('speed-plus').click();
  await expect(page.getByTestId('speed-value')).toHaveText(String(speedBefore + 5));

  await expect(page.getByTestId('font-value')).toHaveText('44px');
  await page.getByTestId('font-plus').click();
  await expect(page.getByTestId('font-value')).toHaveText('46px');
  const fontSize = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-block-type="text"]')!).fontSize
  );
  expect(fontSize).toBe('46px');

  await expect(page.getByTestId('margin-value')).toHaveText('4%');
  await page.getByTestId('margin-plus').click();
  await expect(page.getByTestId('margin-value')).toHaveText('5%');
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
