import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cardByTitle } from './helpers';

async function expectNoAutomaticAccessibilityViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    results.violations
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`)
      .join('\n')
  ).toEqual([]);
}

test('library and App settings pass the automated accessibility scan', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('library-header')).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByTestId('app-settings-button').click();
  await expect(page.getByTestId('app-settings-panel')).toBeVisible();
  await expect(page.getByTestId('countdown-setting')).toBeEnabled();
  await expectNoAutomaticAccessibilityViolations(page);
});

test('the reading surface passes the automated accessibility scan', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await cardByTitle(page, 'Read me first').getByTestId('open-prompter').click();
  await expect(page.getByTestId('prompter-page')).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);
});
