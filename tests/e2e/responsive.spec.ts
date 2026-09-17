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

test('desktop library actions and editor use readable widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('library-header-actions').getByText('Import')).toBeVisible();
  await page.getByTestId('new-script').click();
  const editor = await page.getByTestId('editor-content').boundingBox();
  expect(editor).not.toBeNull();
  expect(editor!.width).toBeLessThanOrEqual(880);
  expect(Math.abs(editor!.x - (1440 - editor!.width) / 2)).toBeLessThan(2);
  await expectNoHorizontalOverflow(page);
});

test('small landscape playback controls remain reachable', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto('/');
  await cardByTitle(page, 'Read me first').getByTestId('open-prompter').click();
  const controls = await page.getByTestId('bottom-controls').boundingBox();
  expect(controls).not.toBeNull();
  expect(controls!.height).toBeLessThan(72);
  for (const id of ['reset-position', 'section-prev', 'play-pause', 'section-next', 'sections-toggle', 'settings-toggle']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box!.x, id).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, id).toBeLessThanOrEqual(568);
    expect(box!.y + box!.height, id).toBeLessThanOrEqual(320);
  }
  await expectNoHorizontalOverflow(page);
});

test('phone touch can open a script, start playback, and reveal controls', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expectNoHorizontalOverflow(page);
    await cardByTitle(page, 'Read me first').getByTestId('open-prompter').tap();
    const playButton = page.getByTestId('play-pause');
    await playButton.tap();
    await expect(playButton).toHaveAttribute('data-playing', 'true');
    await expect(page.getByTestId('bottom-controls')).toBeHidden();
    await page.getByTestId('prompter-viewport').tap({ position: { x: 180, y: 200 } });
    await expect(page.getByTestId('bottom-controls')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});
