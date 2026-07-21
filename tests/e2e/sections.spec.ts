import { expect, test } from '@playwright/test';
import { openScriptInPrompter, prompterOffset } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('navega entre secciones con los botones', async ({ page }) => {
  await openScriptInPrompter(page, 'Welcome to Teleprompter');
  await expect(page.getByTestId('section-indicator')).toHaveText('1 / 4');

  await page.getByTestId('section-next').click();
  await expect(page.getByTestId('section-indicator')).toHaveText('2 / 4');
  await expect(page.getByTestId('section-toast')).toHaveCount(0);
  await expect.poll(() => prompterOffset(page)).toBeGreaterThan(0);
  const heading = await page
    .locator('[data-block-type="heading"]', { hasText: 'Start reading' })
    .boundingBox();
  expect(heading?.y).toBeGreaterThan(300);
  expect(heading?.y).toBeLessThan(380);

  await page.getByTestId('section-prev').click();
  await expect(page.getByTestId('section-indicator')).toHaveText('1 / 4');

  // Límite inferior: no baja de la primera sección.
  await page.getByTestId('section-prev').click();
  await expect(page.getByTestId('section-indicator')).toHaveText('1 / 4');
});

test('el navegador de secciones lista y salta a una sección', async ({ page }) => {
  await openScriptInPrompter(page, 'Welcome to Teleprompter');
  await page.getByTestId('sections-toggle').click();

  const items = page.getByTestId('section-item');
  await expect(items).toHaveCount(4);
  await items.nth(2).click();
  await expect(page.getByTestId('section-indicator')).toHaveText('3 / 4');
});

test('un guion sin headings tiene una única sección implícita', async ({ page }) => {
  await openScriptInPrompter(page, 'Quick notes');
  await expect(page.getByTestId('section-indicator')).toHaveText('1 / 1');
  await page.getByTestId('section-next').click();
  await expect(page.getByTestId('section-indicator')).toHaveText('1 / 1');
});
