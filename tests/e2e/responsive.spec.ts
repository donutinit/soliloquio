import { expect, test, type Page } from '@playwright/test';
import { cardByTitle } from './helpers';

const VIEWPORT_WIDTHS = [320, 375, 414, 768] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  expect(overflow.body).toBeLessThanOrEqual(0);
  expect(overflow.root).toBeLessThanOrEqual(0);
}

test('library and prompter stay inside every supported audit width', async ({ page }) => {
  await page.goto('/');

  for (const width of VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByTestId('library-header')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await cardByTitle(page, 'Read me first').getByTestId('open-prompter').click();
    await expect(page.getByTestId('prompter-page')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByTestId('back-to-scripts').click();
    await expect(page.getByTestId('library-header')).toBeVisible();
  }
});
